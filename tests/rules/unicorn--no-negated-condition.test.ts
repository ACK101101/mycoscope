import { lintRule } from "../harness/lint.ts";

lintRule("unicorn/no-negated-condition", [
    {
        name: "a negated ternary is reported",
        code: "export const pick = (a: boolean): number => !a ? 1 : 2;\n",
        expect: [
            {
                id: "unicorn/no-negated-condition",
                line: 1,
                column: 45,
                text: "!a",
                message: "Unexpected negated condition.",
            },
        ],
    },
    {
        name: "a positive ternary is allowed",
        code: "export const pick = (a: boolean): number => a ? 2 : 1;\n",
        expect: [],
    },
    {
        name: "a negated if without else is allowed",
        code: "export function pick(a: boolean): number {\n    if (!a) {\n        return 1;\n    }\n    return 2;\n}\n",
        expect: [],
    },
]);
