import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a negated ternary is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-negated-condition",
        "export const pick = (a: boolean): number => !a ? 1 : 2;\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-negated-condition",
            line: 1,
            column: 45,
            text: "!a",
            message: "Unexpected negated condition.",
        },
    ]);
});

void test("a positive ternary is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-negated-condition",
        "export const pick = (a: boolean): number => a ? 2 : 1;\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("a negated if without else is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-negated-condition",
        "export function pick(a: boolean): number {\n    if (!a) {\n        return 1;\n    }\n    return 2;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
