import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("unicorn/no-array-callback-reference", [
    {
        name: "a function reference passed to map is reported",
        code: "const double = (n: number): number => n * 2;\nexport const doubled = (xs: number[]): number[] => xs.map(double);\n",
        expect: [
            {
                id: "unicorn/no-array-callback-reference",
                line: 2,
                column: 59,
                text: "double",
            },
        ],
    },
    {
        name: "parseInt passed to map is reported: the index would become the radix",
        code: "export const ints = (xs: string[]): number[] => xs.map(parseInt);\n",
        expect: [
            {
                id: "unicorn/no-array-callback-reference",
                line: 1,
                column: 56,
                text: "parseInt",
            },
        ],
    },
    {
        name: "a named call inside an arrow function is allowed",
        code: "const double = (n: number): number => n * 2;\nexport const doubled = (xs: number[]): number[] => xs.map((x) => double(x));\n",
        expect: [],
    },
]);
