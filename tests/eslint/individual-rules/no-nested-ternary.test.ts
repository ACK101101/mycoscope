import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("no-nested-ternary", [
    {
        name: "a ternary inside a ternary is reported",
        code: 'export const label = (n: number): string => n > 0 ? "pos" : n < 0 ? "neg" : "zero";\n',
        expect: [
            {
                id: "no-nested-ternary",
                line: 1,
                column: 45,
                text: 'n > 0 ? "pos" : n < 0 ? "neg" : "zero"',
                message: "Do not nest ternary expressions.",
            },
        ],
    },
    {
        name: "a single ternary is allowed",
        code: 'export const label = (n: number): string => n > 0 ? "pos" : "other";\n',
        expect: [],
    },
]);
