import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/explicit-function-return-type", [
    {
        name: "a function without a return type is reported",
        code: "export function f(x: number) {\n    return x + 1;\n}\n",
        expect: [
            {
                id: "@typescript-eslint/explicit-function-return-type",
                severity: 2,
                line: 1,
                column: 8,
                text: "function f",
                message: "Missing return type on function.",
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
