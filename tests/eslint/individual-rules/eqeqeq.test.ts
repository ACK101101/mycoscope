import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("eqeqeq", [
    {
        name: "loose equality is reported",
        code: "export const same = (a: number, b: number): boolean => a == b;\n",
        expect: [
            {
                id: "eqeqeq",
                line: 1,
                column: 58,
                text: "==",
                message: "Expected '===' and instead saw '=='.",
            },
        ],
    },
    {
        name: "loose equality against null is reported too",
        code: "export const absent = (a: string | null): boolean => a == null;\n",
        expect: [
            {
                id: "eqeqeq",
                line: 1,
                column: 56,
                text: "==",
                message: "Expected '===' and instead saw '=='.",
            },
        ],
    },
    {
        name: "strict equality is allowed",
        code: "export const same = (a: number, b: number): boolean => a === b;\n",
        expect: [],
    },
]);
