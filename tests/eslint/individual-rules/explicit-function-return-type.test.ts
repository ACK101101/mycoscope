import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a function without a return type is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/explicit-function-return-type",
        "export function f(x: number) {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/explicit-function-return-type",
            severity: 2,
            line: 1,
            column: 8,
            text: "function f",
            message: "Missing return type on function.",
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/explicit-function-return-type",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
