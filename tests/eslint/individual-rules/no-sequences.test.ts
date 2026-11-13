import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("the comma operator is reported", async () => {
    const diagnostics = await lintRule(
        "no-sequences",
        "export const last = (a: number, b: number): number => (a, b);\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-sequences",
            line: 1,
            column: 57,
            text: ",",
            message: "Unexpected use of comma operator.",
        },
    ]);
});

void test("commas in arguments and arrays are allowed", async () => {
    const diagnostics = await lintRule(
        "no-sequences",
        "export const pair = (a: number, b: number): number[] => [a, b];\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
