import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

const MESSAGE =
    "`Array#reduce()` is not allowed. Prefer other types of loop for readability.";
void test("reduce is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-array-reduce",
        "export const total = (xs: number[]): number => xs.reduce((sum, x) => sum + x * x, 0);\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-array-reduce",
            line: 1,
            column: 51,
            text: "reduce",
            message: MESSAGE,
        },
    ]);
});

void test("a simple-operation reduce is reported too: allowSimpleOperations is off", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-array-reduce",
        "export const total = (xs: number[]): number => xs.reduce((a, b) => a + b);\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-array-reduce",
            line: 1,
            column: 51,
            text: "reduce",
            message: MESSAGE,
        },
    ]);
});

void test("a for...of loop is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-array-reduce",
        "export function total(xs: number[]): number {\n    let sum = 0;\n    for (const x of xs) {\n        sum += x;\n    }\n    return sum;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
