import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("unicorn/no-unreadable-object-destructuring", [
    {
        name: "destructuring three levels deep is reported",
        code: "export function deep(o: { a: { b: { c: number } } }): number {\n    const { a: { b: { c } } } = o;\n    return c;\n}\n",
        expect: [
            {
                id: "unicorn/no-unreadable-object-destructuring",
                line: 2,
                column: 21,
                text: "{ c }",
                message:
                    "Do not use object destructuring deeper than two levels.",
            },
        ],
    },
    {
        name: "destructuring two levels deep is allowed",
        code: "export function two(o: { a: { b: number } }): number {\n    const { a: { b } } = o;\n    return b;\n}\n",
        expect: [],
    },
]);
