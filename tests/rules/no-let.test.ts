import { lintRule } from "../harness/lint.ts";

const MESSAGE = "Unexpected let, use const instead.";

lintRule("functional/no-let", [
    {
        name: "module-level let is reported",
        code: "export let count = 0;\n",
        expect: [
            {
                id: "functional/no-let",
                line: 1,
                column: 8,
                text: "let count = 0;",
                message: MESSAGE,
            },
        ],
    },
    {
        name: "a module-level let that is not exported is reported",
        code: "let count = 0;\nexport const read = (): number => count;\n",
        expect: [
            {
                id: "functional/no-let",
                line: 1,
                column: 1,
                text: "let count = 0;",
                message: MESSAGE,
            },
        ],
    },
    {
        name: "each module-level let is reported, in source order",
        code: "export let a = 1;\nexport let b = 2;\n",
        expect: [
            {
                id: "functional/no-let",
                line: 1,
                column: 8,
                text: "let a = 1;",
                message: MESSAGE,
            },
            {
                id: "functional/no-let",
                line: 2,
                column: 8,
                text: "let b = 2;",
                message: MESSAGE,
            },
        ],
    },
    {
        name: "other rules are off: `any` on the let is not reported",
        code: "export let x: any = 1;\n",
        expect: [
            {
                id: "functional/no-let",
                line: 1,
                column: 8,
                text: "let x: any = 1;",
                message: MESSAGE,
            },
        ],
    },
    {
        name: "let inside a function is allowed",
        code: "export function bump(): number {\n    let n = 0;\n    n += 1;\n    return n;\n}\n",
        expect: [],
    },
    {
        name: "let inside an arrow function is allowed",
        code: "export const bump = (): number => {\n    let n = 0;\n    n += 1;\n    return n;\n};\n",
        expect: [],
    },
    {
        name: "const at module level is allowed",
        code: "export const count = 0;\n",
        expect: [],
    },
]);
