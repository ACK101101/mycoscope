import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@eslint-community/eslint-comments/no-unlimited-disable", [
    {
        name: "a disable directive without rule names is reported",
        code: "export function f(x: unknown): string {\n    // eslint-disable-next-line -- blanket disable hides which rule\n    return String(x);\n}\n",
        expect: [
            {
                id: "@eslint-community/eslint-comments/no-unlimited-disable",
                severity: 2,
                line: 2,
                column: 0,
                text: "\n    // eslint-disable-next-line -- blanket disable hides which rule",
                message:
                    "Unexpected unlimited 'eslint-disable-next-line' comment. Specify some rule names to disable.",
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
