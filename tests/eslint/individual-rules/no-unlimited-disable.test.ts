import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a disable directive without rule names is reported", async () => {
    const diagnostics = await lintRule(
        "@eslint-community/eslint-comments/no-unlimited-disable",
        "export function f(x: unknown): string {\n    // eslint-disable-next-line -- blanket disable hides which rule\n    return String(x);\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@eslint-community/eslint-comments/no-unlimited-disable",
            severity: 2,
            line: 2,
            column: 0,
            text: "\n    // eslint-disable-next-line -- blanket disable hides which rule",
            message:
                "Unexpected unlimited 'eslint-disable-next-line' comment. Specify some rule names to disable.",
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "@eslint-community/eslint-comments/no-unlimited-disable",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
