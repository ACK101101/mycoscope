import { lintRule } from "../harness/lint.ts";

lintRule("unicorn/no-lonely-if", [
    {
        name: "an if that is the only statement of an if is reported",
        code: "export function both(a: boolean, b: boolean): number {\n    if (a) {\n        if (b) {\n            return 1;\n        }\n    }\n    return 0;\n}\n",
        expect: [
            {
                id: "unicorn/no-lonely-if",
                line: 3,
                column: 9,
                text: "if (b) {\n            return 1;\n        }",
                message:
                    "Unexpected `if` as the only statement in a `if` block without `else`.",
            },
        ],
    },
    {
        name: "a combined condition is allowed",
        code: "export function both(a: boolean, b: boolean): number {\n    if (a && b) {\n        return 1;\n    }\n    return 0;\n}\n",
        expect: [],
    },
    {
        name: "an inner if next to another statement is allowed",
        code: "export function both(a: boolean, b: boolean): number {\n    if (a) {\n        const n = 1;\n        if (b) {\n            return n;\n        }\n    }\n    return 0;\n}\n",
        expect: [],
    },
]);
