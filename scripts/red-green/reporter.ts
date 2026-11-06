import { realpathSync } from "node:fs";
import type { Mut } from "../../src/mutation.js";
import { relative } from "node:path";
import type { TestEvent } from "node:test/reporters";
import {
    json,
    record,
    type Failure,
    type Result,
    type Summary,
} from "./model.ts";

export function failure(error: unknown): Failure {
    const cause: unknown = record(error) ? error["cause"] : undefined;
    if (
        record(error) &&
        error["failureType"] === "testCodeFailure" &&
        record(cause) &&
        cause["code"] === "ERR_ASSERTION" &&
        cause["redGreen"] === "mycoscope:behavior:1" &&
        typeof cause["operator"] === "string" &&
        json(cause["actual"]) &&
        json(cause["expected"])
    ) {
        return {
            kind: "assertion",
            operator: cause["operator"],
            actual: cause["actual"],
            expected: cause["expected"],
        };
    }
    return {
        kind: "setup",
        message: error instanceof Error ? error.message : String(error),
    };
}
export default async function* reporter(
    source: AsyncIterable<TestEvent>,
): AsyncGenerator<string, void, unknown> {
    const pending: Mut<Result[]> = [];
    for await (const event of source) {
        if (event.type === "test:pass" || event.type === "test:fail") {
            const data = event.data;
            if (data.details.type === "suite") continue;
            const skipped =
                (data.skip !== undefined && data.skip !== false) ||
                (data.todo !== undefined && data.todo !== false);
            let status: Result["status"] = "fail";
            if (skipped) status = "skip";
            else if (event.type === "test:pass") status = "pass";
            const result: Result = {
                type: "result",
                file:
                    data.file === undefined
                        ? "<unknown>"
                        : relative(process.cwd(), data.file),
                name: data.name,
                status,
                ...(event.type === "test:fail"
                    ? { error: failure(event.data.details.error) }
                    : {}),
            };
            pending.push(result);
        }
        if (event.type === "test:summary" && event.data.file !== undefined) {
            const entry = relative(
                process.cwd(),
                realpathSync(event.data.file),
            );
            for (const result of pending)
                yield JSON.stringify({ ...result, file: entry }) + "\n";
            pending.length = 0;
        }
        if (event.type === "test:summary" && event.data.file === undefined) {
            // A crashed worker may never emit a per-file summary. Keep its setup failure visible.
            for (const result of pending) yield JSON.stringify(result) + "\n";
            pending.length = 0;
            const data = event.data;
            const counts = data.counts;
            const rawCounts: unknown = counts;
            const failed: unknown = record(rawCounts)
                ? rawCounts["failed"]
                : undefined;
            const summary: Summary = {
                type: "summary",
                success: data.success,
                tests: counts.tests,
                passed: counts.passed,
                failed:
                    typeof failed === "number"
                        ? failed
                        : counts.tests -
                          counts.passed -
                          counts.skipped -
                          counts.todo -
                          counts.cancelled,
                skipped: counts.skipped,
                todo: counts.todo,
                cancelled: counts.cancelled,
            };
            yield JSON.stringify(summary) + "\n";
        }
    }
}
