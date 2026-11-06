import { lintRule } from "../harness/lint.ts";

lintRule("no-implicit-coercion", [
    {
        name: "!! is reported",
        code: "export const flag = (s: string): boolean => !!s;\n",
        expect: [
            {
                id: "no-implicit-coercion",
                line: 1,
                column: 45,
                text: "!!s",
            },
        ],
    },
    {
        name: "unary + is reported",
        code: "export const num = (s: string): number => +s;\n",
        expect: [
            {
                id: "no-implicit-coercion",
                line: 1,
                column: 43,
                text: "+s",
            },
        ],
    },
    {
        name: "Boolean() and Number() are allowed",
        code: "export const both = (s: string): [boolean, number] => [Boolean(s), Number(s)];\n",
        expect: [],
    },
]);
