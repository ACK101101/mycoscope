import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("an explicit any annotation is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/no-explicit-any",
        "export function f(x: any): unknown {\n    return x;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/no-explicit-any",
            severity: 2,
            line: 1,
            column: 22,
            text: "any",
            message: "Unexpected any. Specify a different type.",
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/no-explicit-any",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
