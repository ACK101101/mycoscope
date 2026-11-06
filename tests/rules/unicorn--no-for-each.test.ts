import { lintRule } from "../harness/lint.ts";

lintRule("unicorn/no-for-each", [
    {
        name: "forEach is reported",
        code: "export function copy(xs: string[]): string[] {\n    const seen: string[] = [];\n    xs.forEach((x) => {\n        seen.push(x);\n    });\n    return seen;\n}\n",
        expect: [
            {
                id: "unicorn/no-for-each",
                line: 3,
                column: 8,
                text: "forEach",
                message: "Use `for…of` instead of `.forEach(…)`.",
            },
        ],
    },
    {
        name: "a for...of loop is allowed",
        code: "export function copy(xs: string[]): string[] {\n    const seen: string[] = [];\n    for (const x of xs) {\n        seen.push(x);\n    }\n    return seen;\n}\n",
        expect: [],
    },
]);
