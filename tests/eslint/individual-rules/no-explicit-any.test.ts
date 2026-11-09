import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/no-explicit-any", [
    {
        name: "an explicit any annotation is reported",
        code: "export function f(x: any): unknown {\n    return x;\n}\n",
        expect: [
            {
                id: "@typescript-eslint/no-explicit-any",
                severity: 2,
                line: 1,
                column: 22,
                text: "any",
                message: "Unexpected any. Specify a different type.",
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
