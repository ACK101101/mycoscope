import type { Mut } from "../../src/mutation.js";

export type Json =
    | null
    | boolean
    | number
    | string
    | readonly Json[]
    | { readonly [key: string]: Json };
export interface Assertion {
    readonly operator: string;
    readonly actual: Json;
    readonly expected: Json;
}
export type Baseline =
    | { readonly status: "pass" }
    | { readonly status: "fail"; readonly assertion: Assertion };
export interface ContractCase {
    readonly file: string;
    readonly name: string;
    readonly claim: string;
    readonly baseline: Baseline;
}
export interface Manifest {
    readonly version: 1;
    readonly baseline: string;
    readonly cases: readonly ContractCase[];
}
export type Failure =
    | ({ readonly kind: "assertion" } & Assertion)
    | { readonly kind: "setup"; readonly message: string };
export interface Result {
    readonly type: "result";
    readonly file: string;
    readonly name: string;
    readonly status: "pass" | "fail" | "skip";
    readonly error?: Failure;
}
export interface Summary {
    readonly type: "summary";
    readonly success: boolean;
    readonly tests: number;
    readonly failed: number;
    readonly passed: number;
    readonly skipped: number;
    readonly todo: number;
    readonly cancelled: number;
}
export interface Transcript {
    readonly results: readonly Result[];
    readonly summary: Summary;
}
export function record(
    value: unknown,
): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function json(value: unknown): value is Json {
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean"
    )
        return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every((item: unknown) => json(item));
    return (
        record(value) &&
        (Object.getPrototypeOf(value) === Object.prototype ||
            Object.getPrototypeOf(value) === null) &&
        Object.values(value).every((item) => json(item))
    );
}
function assertion(value: unknown): value is Assertion {
    return (
        record(value) &&
        typeof value["operator"] === "string" &&
        value["operator"].length > 0 &&
        json(value["actual"]) &&
        json(value["expected"])
    );
}
export function commitId(value: unknown): value is string {
    return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}
export function testPath(value: unknown): value is string {
    return (
        typeof value === "string" &&
        /^tests\/[a-zA-Z0-9_./-]+\.test\.ts$/.test(value) &&
        !value.split("/").includes("..")
    );
}
function contractCase(value: unknown): value is ContractCase {
    if (
        !record(value) ||
        !testPath(value["file"]) ||
        typeof value["name"] !== "string" ||
        value["name"].trim().length === 0 ||
        typeof value["claim"] !== "string" ||
        value["claim"].trim().length === 0
    )
        return false;
    const baseline = value["baseline"];
    return (
        record(baseline) &&
        (baseline["status"] === "pass" ||
            (baseline["status"] === "fail" && assertion(baseline["assertion"])))
    );
}
export function identity(value: Pick<ContractCase, "file" | "name">): string {
    return JSON.stringify([value.file, value.name]);
}
export function parseManifest(value: unknown): Manifest {
    if (
        !record(value) ||
        value["version"] !== 1 ||
        !commitId(value["baseline"])
    )
        throw new Error(
            "Contract requires version 1 and a full baseline commit SHA.",
        );
    const cases = value["cases"];
    if (
        !Array.isArray(cases) ||
        !cases.every((item: unknown): item is ContractCase =>
            contractCase(item),
        ) ||
        cases.length === 0
    )
        throw new Error(
            "Contract requires named cases, safe .test.ts paths and explicit baseline outcomes.",
        );
    const identities = new Set(cases.map((item) => identity(item)));
    if (identities.size !== cases.length)
        throw new Error("Duplicate contract case identity.");
    const claims = new Set(cases.map((item) => item.claim));
    for (const claim of claims)
        if (
            !cases.some(
                (item) =>
                    item.claim === claim && item.baseline.status === "fail",
            )
        )
            throw new Error(
                `Claim ${claim} has no distinguishing baseline failure.`,
            );
    return { version: 1, baseline: value["baseline"], cases };
}
function result(value: unknown): value is Result {
    if (
        !record(value) ||
        value["type"] !== "result" ||
        typeof value["file"] !== "string" ||
        typeof value["name"] !== "string" ||
        typeof value["status"] !== "string" ||
        !["pass", "fail", "skip"].includes(value["status"])
    )
        return false;
    const error = value["error"];
    return (
        value["status"] !== "fail" ||
        (record(error) &&
            ((error["kind"] === "setup" &&
                typeof error["message"] === "string") ||
                (error["kind"] === "assertion" && assertion(error))))
    );
}
function summary(value: unknown): value is Summary {
    return (
        record(value) &&
        value["type"] === "summary" &&
        typeof value["success"] === "boolean" &&
        [
            value["tests"],
            value["failed"],
            value["passed"],
            value["skipped"],
            value["todo"],
            value["cancelled"],
        ].every(
            (count) =>
                typeof count === "number" &&
                Number.isSafeInteger(count) &&
                count >= 0,
        )
    );
}
export function parseTranscript(text: string): Transcript {
    const results: Mut<Result[]> = [];
    let totals: Summary | undefined;
    for (const line of text.split("\n")) {
        if (line.trim().length === 0) continue;
        const value: unknown = JSON.parse(line);
        if (result(value)) results.push(value);
        else if (summary(value) && totals === undefined) totals = value;
        else throw new Error("Invalid or duplicate structured test event.");
    }
    if (totals === undefined)
        throw new Error(
            "Test process did not produce a complete global summary.",
        );
    return { results, summary: totals };
}
