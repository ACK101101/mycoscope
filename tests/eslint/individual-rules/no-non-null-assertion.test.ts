import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a non-null assertion is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/no-non-null-assertion",
        'export function f(m: Map<string, number>): number {\n    return m.get("a")!;\n}\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/no-non-null-assertion",
            severity: 2,
            line: 2,
            column: 12,
            text: 'm.get("a")!',
            message: "Forbidden non-null assertion.",
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/no-non-null-assertion",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
