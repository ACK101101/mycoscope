import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("unicorn/no-unreadable-for-of-expression", [
    {
        name: "a complex iterable in the loop header is reported",
        code: "export function inner(xs: number[]): number[] {\n    const out: number[] = [];\n    for (const x of xs.slice(1, xs.length - 1)) {\n        out.push(x);\n    }\n    return out;\n}\n",
        expect: [
            {
                id: "unicorn/no-unreadable-for-of-expression",
                line: 3,
                column: 21,
                text: "xs.slice(1, xs.length - 1)",
            },
        ],
    },
    {
        name: "a named iterable is allowed",
        code: "export function copy(xs: number[]): number[] {\n    const out: number[] = [];\n    for (const x of xs) {\n        out.push(x);\n    }\n    return out;\n}\n",
        expect: [],
    },
]);
