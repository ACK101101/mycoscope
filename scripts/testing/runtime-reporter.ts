import { readFileSync } from "node:fs";
import type { TestEvent } from "node:test/reporters";
import {
    budgetWarnings,
    DEFAULT_BUDGETS,
    parseBudgets,
    type Budgets,
} from "./budgets.ts";

function configuration(): Budgets {
    const raw: unknown = JSON.parse(
        readFileSync(
            new URL("../../test-budgets.json", import.meta.url),
            "utf8",
        ),
    );
    return parseBudgets(raw);
}
function annotation(message: string): string {
    const escaped = message
        .replaceAll("%", "%25")
        .replaceAll("\r", "%0D")
        .replaceAll("\n", "%0A");
    return process.env["GITHUB_ACTIONS"] === "true"
        ? `::warning::${escaped}\n`
        : `[test-budget] ${message}\n`;
}
export default async function* reporter(
    source: AsyncIterable<TestEvent>,
): AsyncGenerator<string, void, unknown> {
    let budgets = DEFAULT_BUDGETS;
    try {
        budgets = configuration();
    } catch (error: unknown) {
        yield annotation(
            `Invalid runtime budget configuration; using defaults: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    let slow = 0;
    for await (const event of source) {
        if (
            (event.type === "test:pass" || event.type === "test:fail") &&
            event.data.details.type !== "suite"
        ) {
            const warnings = budgetWarnings(
                {
                    kind: "test",
                    name: event.data.name,
                    durationMs: event.data.details.duration_ms,
                },
                budgets,
            );
            slow += warnings.length;
            for (const warning of warnings) yield annotation(warning);
        }
        if (event.type === "test:summary" && event.data.file === undefined) {
            const warnings = budgetWarnings(
                {
                    kind: "suite",
                    name: "test run",
                    durationMs: event.data.duration_ms,
                },
                budgets,
            );
            for (const warning of warnings) yield annotation(warning);
            if (slow > 0)
                yield `[test-budget] ${String(slow)} test(s) exceeded their soft runtime budget; test outcomes are unchanged.\n`;
        }
    }
}
