import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/strict-boolean-expressions", [
    {
        name: "a string used as a condition is reported",
        code: 'export const label = (s: string): string => {\n    if (s) return s;\n    return "none";\n};\n',
        expect: [
            {
                id: "@typescript-eslint/strict-boolean-expressions",
                line: 2,
                column: 9,
                text: "s",
                message:
                    "Unexpected string value in conditional. An explicit empty string check is required.",
            },
        ],
    },
    {
        name: "a number used as a condition is reported",
        code: "export const has = (n: number): boolean => (n ? true : false);\n",
        expect: [
            {
                id: "@typescript-eslint/strict-boolean-expressions",
                line: 1,
                column: 45,
                text: "n",
                message:
                    "Unexpected number value in conditional. An explicit zero/NaN check is required.",
            },
        ],
    },
    {
        name: "an explicit comparison is allowed",
        code: 'export const label = (s: string): string => {\n    if (s !== "") return s;\n    return "none";\n};\n',
        expect: [],
    },
]);
