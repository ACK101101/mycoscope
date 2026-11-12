import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("calling a value typed as any is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/no-unsafe-call",
        "declare const g: any;\nexport function f(): void {\n    g();\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/no-unsafe-call",
            severity: 2,
            line: 3,
            column: 5,
            text: "g",
            message: "Unsafe call of an `any` typed value.",
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/no-unsafe-call",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
