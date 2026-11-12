import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a disable directive without a reason is reported", async () => {
    const diagnostics = await lintRule(
        "@eslint-community/eslint-comments/require-description",
        "export function f(x: unknown): string {\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions\n    return x as string;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@eslint-community/eslint-comments/require-description",
            severity: 2,
            line: 2,
            column: 0,
            text: "\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions",
            message:
                "Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.",
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "@eslint-community/eslint-comments/require-description",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
