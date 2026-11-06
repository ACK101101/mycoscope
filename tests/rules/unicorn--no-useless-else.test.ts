import { lintRule } from "../harness/lint.ts";

lintRule("unicorn/no-useless-else", [
    {
        name: "an else after a return is reported",
        code: "export function pick(a: boolean): number {\n    if (a) {\n        return 1;\n    } else {\n        return 2;\n    }\n}\n",
        expect: [
            {
                id: "unicorn/no-useless-else",
                line: 4,
                column: 7,
                text: "else",
                message: "Unexpected `else` after a statement that exits.",
            },
        ],
    },
    {
        name: "code after the if is allowed",
        code: "export function pick(a: boolean): number {\n    if (a) {\n        return 1;\n    }\n    return 2;\n}\n",
        expect: [],
    },
    {
        name: "an else after a branch that does not exit is allowed",
        code: "export function pick(a: boolean): number {\n    let n = 0;\n    if (a) {\n        n = 1;\n    } else {\n        n = 2;\n    }\n    return n;\n}\n",
        expect: [],
    },
]);
