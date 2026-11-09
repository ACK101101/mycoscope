import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("no-sequences", [
    {
        name: "the comma operator is reported",
        code: "export const last = (a: number, b: number): number => (a, b);\n",
        expect: [
            {
                id: "no-sequences",
                line: 1,
                column: 57,
                text: ",",
                message: "Unexpected use of comma operator.",
            },
        ],
    },
    {
        name: "commas in arguments and arrays are allowed",
        code: "export const pair = (a: number, b: number): number[] => [a, b];\n",
        expect: [],
    },
]);
