import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@eslint-community/eslint-comments/require-description", [
    {
        name: "a disable directive without a reason is reported",
        code: "export function f(x: unknown): string {\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions\n    return x as string;\n}\n",
        expect: [
            {
                id: "@eslint-community/eslint-comments/require-description",
                severity: 2,
                line: 2,
                column: 0,
                text: "\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions",
                message:
                    "Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.",
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
