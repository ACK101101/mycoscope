import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a string used as a condition is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/strict-boolean-expressions",
        'export const label = (s: string): string => {\n    if (s) return s;\n    return "none";\n};\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/strict-boolean-expressions",
            line: 2,
            column: 9,
            text: "s",
            message:
                "Unexpected string value in conditional. An explicit empty string check is required.",
        },
    ]);
});

void test("a number used as a condition is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/strict-boolean-expressions",
        "export const has = (n: number): boolean => (n ? true : false);\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/strict-boolean-expressions",
            line: 1,
            column: 45,
            text: "n",
            message:
                "Unexpected number value in conditional. An explicit zero/NaN check is required.",
        },
    ]);
});

void test("an explicit comparison is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/strict-boolean-expressions",
        'export const label = (s: string): string => {\n    if (s !== "") return s;\n    return "none";\n};\n',
    );
    assertDiagnosticsMatch(diagnostics, []);
});
