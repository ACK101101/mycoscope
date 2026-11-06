import { lintRule } from "../harness/lint.ts";

lintRule("unicorn/no-unreadable-array-destructuring", [
    {
        name: "consecutive ignored elements are reported",
        code: "export function third(xs: number[]): number | undefined {\n    const [,, x] = xs;\n    return x;\n}\n",
        expect: [
            {
                id: "unicorn/no-unreadable-array-destructuring",
                line: 2,
                column: 11,
                text: "[,, x]",
                message:
                    "Array destructuring may not contain consecutive ignored values.",
            },
        ],
    },
    {
        name: "a single ignored element is allowed",
        code: "export function second(xs: number[]): number | undefined {\n    const [, x] = xs;\n    return x;\n}\n",
        expect: [],
    },
]);
