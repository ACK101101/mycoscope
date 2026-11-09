import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/consistent-type-assertions", [
    {
        name: "a type assertion is reported",
        code: "export function f(x: unknown): string {\n    return x as string;\n}\n",
        expect: [
            {
                id: "@typescript-eslint/consistent-type-assertions",
                severity: 2,
                line: 2,
                column: 12,
                text: "x as string",
                message: "Do not use any type assertions.",
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
    {
        name: "a disable with a reason suppresses the assertion diagnostic",
        code: "export function f(x: unknown): string {\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixture: reasoned disable is allowed\n    return x as string;\n}\n",
        expect: [],
    },
]);
