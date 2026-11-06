import { isDeepStrictEqual } from "node:util";
import type { Mut } from "../../src/mutation.js";
import { identity, type Manifest, type Transcript } from "./model.ts";

export function checkEvidence(
    manifest: Manifest,
    transcript: Transcript,
    phase: "baseline" | "candidate",
    exitCode: number | null,
): readonly string[] {
    const errors: Mut<string[]> = [];
    const expected = new Map(
        manifest.cases.map((item) => [identity(item), item]),
    );
    const selectedFiles = new Set(manifest.cases.map((item) => item.file));
    const seen: Mut<Set<string>> = new Set();
    let failures = 0;
    for (const result of transcript.results) {
        const key = identity(result);
        const selected = selectedFiles.has(result.file);
        if (selected && seen.has(key)) errors.push(`Duplicate result: ${key}`);
        seen.add(key);
        const declared = expected.get(key);
        if (selected && declared === undefined)
            errors.push(`Unlisted case in contract test file: ${key}`);
        if (result.status === "skip") errors.push(`Skipped case: ${key}`);
        const outcome =
            phase === "baseline" && declared !== undefined
                ? declared.baseline
                : { status: "pass" };
        if (result.status === "fail") failures += 1;
        if (result.status !== outcome.status)
            errors.push(
                `${phase} outcome mismatch: ${key}, expected ${outcome.status}, observed ${result.status}`,
            );
        if (outcome.status === "fail" && declared?.baseline.status === "fail") {
            const error = result.error;
            const wanted = declared.baseline.assertion;
            if (
                error?.kind !== "assertion" ||
                error.operator !== wanted.operator ||
                !isDeepStrictEqual(error.actual, wanted.actual) ||
                !isDeepStrictEqual(error.expected, wanted.expected)
            )
                errors.push(
                    `Expected assertion fingerprint did not match: ${key}; observed ${JSON.stringify(error)}`,
                );
        }
    }
    for (const [key] of expected)
        if (!seen.has(key)) errors.push(`Missing case: ${key}`);
    const totals = transcript.summary;
    if (
        totals.tests !== transcript.results.length ||
        totals.failed !== failures ||
        totals.passed !==
            transcript.results.filter((item) => item.status === "pass")
                .length ||
        totals.tests !==
            totals.passed +
                totals.failed +
                totals.skipped +
                totals.todo +
                totals.cancelled
    )
        errors.push("Global summary does not match observed cases.");
    if (totals.skipped !== 0 || totals.todo !== 0 || totals.cancelled !== 0)
        errors.push("Skipped, TODO or cancelled tests are not evidence.");
    if (
        totals.success !== (failures === 0) ||
        exitCode !== (failures === 0 ? 0 : 1)
    )
        errors.push("Process exit status and global summary disagree.");
    return errors;
}

export function sameInventory(
    baseline: Transcript,
    candidate: Transcript,
): boolean {
    const before = baseline.results
        .map((result) => identity(result))
        .toSorted();
    const after = candidate.results
        .map((result) => identity(result))
        .toSorted();
    return isDeepStrictEqual(before, after);
}
