import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("an IIFE with a parenthesized arrow body is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-iife",
        "export const n = (() => (1))();\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-unreadable-iife",
            line: 1,
            column: 25,
            text: "(1)",
            message:
                "IIFE with parenthesized arrow function body is considered unreadable.",
        },
    ]);
});

void test("an IIFE with a block body is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-iife",
        "export const n = (() => {\n    return 1;\n})();\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
