import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("no-new-func", [
    {
        name: "the Function constructor is reported",
        code: 'export const make = new Function("return 1");\n',
        expect: [
            {
                id: "no-new-func",
                severity: 2,
                line: 1,
                column: 21,
                text: 'new Function("return 1")',
                message: "The Function constructor is eval.",
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
