import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("no-eval", [
    {
        name: "eval is reported",
        code: "export function f(s: string): unknown {\n    return eval(s);\n}\n",
        expect: [
            {
                id: "no-eval",
                severity: 2,
                line: 2,
                column: 12,
                text: "eval",
                message: "`eval` can be harmful.",
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
