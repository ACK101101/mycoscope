import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/no-unsafe-call", [
    {
        name: "calling a value typed as any is reported",
        code: "declare const g: any;\nexport function f(): void {\n    g();\n}\n",
        expect: [
            {
                id: "@typescript-eslint/no-unsafe-call",
                severity: 2,
                line: 3,
                column: 5,
                text: "g",
                message: "Unsafe call of an `any` typed value.",
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
