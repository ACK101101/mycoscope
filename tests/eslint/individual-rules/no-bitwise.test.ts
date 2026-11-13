import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a bitwise operator is reported", async () => {
    const diagnostics = await lintRule(
        "no-bitwise",
        "export const both = (a: number, b: number): number => a | b;\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-bitwise",
            line: 1,
            column: 55,
            text: "a | b",
            message: "Unexpected use of '|'.",
        },
    ]);
});

void test("the logical operator is allowed", async () => {
    const diagnostics = await lintRule(
        "no-bitwise",
        "export const both = (a: boolean, b: boolean): boolean => a || b;\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
