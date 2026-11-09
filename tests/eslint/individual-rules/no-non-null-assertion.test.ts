import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/no-non-null-assertion", [
    {
        name: "a non-null assertion is reported",
        code: 'export function f(m: Map<string, number>): number {\n    return m.get("a")!;\n}\n',
        expect: [
            {
                id: "@typescript-eslint/no-non-null-assertion",
                severity: 2,
                line: 2,
                column: 12,
                text: 'm.get("a")!',
                message: "Forbidden non-null assertion.",
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
