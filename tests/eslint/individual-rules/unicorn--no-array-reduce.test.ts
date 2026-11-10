import { testLintRule } from "../../harness/lint-adapter.ts";

const MESSAGE =
    "`Array#reduce()` is not allowed. Prefer other types of loop for readability.";

testLintRule("unicorn/no-array-reduce", [
    {
        name: "reduce is reported",
        code: "export const total = (xs: number[]): number => xs.reduce((sum, x) => sum + x * x, 0);\n",
        expect: [
            {
                id: "unicorn/no-array-reduce",
                line: 1,
                column: 51,
                text: "reduce",
                message: MESSAGE,
            },
        ],
    },
    {
        name: "a simple-operation reduce is reported too: allowSimpleOperations is off",
        code: "export const total = (xs: number[]): number => xs.reduce((a, b) => a + b);\n",
        expect: [
            {
                id: "unicorn/no-array-reduce",
                line: 1,
                column: 51,
                text: "reduce",
                message: MESSAGE,
            },
        ],
    },
    {
        name: "a for...of loop is allowed",
        code: "export function total(xs: number[]): number {\n    let sum = 0;\n    for (const x of xs) {\n        sum += x;\n    }\n    return sum;\n}\n",
        expect: [],
    },
]);
