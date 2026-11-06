import { lintRule } from "../harness/lint.ts";

lintRule("no-return-assign", [
    {
        name: "assigning in a return is reported",
        code: "export function set(): number {\n    let n = 0;\n    return n = 1;\n}\n",
        expect: [
            {
                id: "no-return-assign",
                line: 3,
                column: 5,
                text: "return n = 1;",
                message: "Return statement should not contain assignment.",
            },
        ],
    },
    {
        name: "assigning before returning is allowed",
        code: "export function set(): number {\n    let n = 0;\n    n = 1;\n    return n;\n}\n",
        expect: [],
    },
]);
