import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("no-bitwise", [
    {
        name: "a bitwise operator is reported",
        code: "export const both = (a: number, b: number): number => a | b;\n",
        expect: [
            {
                id: "no-bitwise",
                line: 1,
                column: 55,
                text: "a | b",
                message: "Unexpected use of '|'.",
            },
        ],
    },
    {
        name: "the logical operator is allowed",
        code: "export const both = (a: boolean, b: boolean): boolean => a || b;\n",
        expect: [],
    },
]);
