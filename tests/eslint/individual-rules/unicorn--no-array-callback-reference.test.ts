import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a function reference passed to map is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-array-callback-reference",
        "const double = (n: number): number => n * 2;\nexport const doubled = (xs: number[]): number[] => xs.map(double);\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-array-callback-reference",
            line: 2,
            column: 59,
            text: "double",
        },
    ]);
});

void test("parseInt passed to map is reported: the index would become the radix", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-array-callback-reference",
        "export const ints = (xs: string[]): number[] => xs.map(parseInt);\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-array-callback-reference",
            line: 1,
            column: 56,
            text: "parseInt",
        },
    ]);
});

void test("a named call inside an arrow function is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-array-callback-reference",
        "const double = (n: number): number => n * 2;\nexport const doubled = (xs: number[]): number[] => xs.map((x) => double(x));\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
