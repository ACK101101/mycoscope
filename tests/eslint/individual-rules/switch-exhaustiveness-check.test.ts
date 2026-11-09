import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/switch-exhaustiveness-check", [
    {
        name: "a switch with a missing union member is reported",
        code: 'type U = "a" | "b";\nexport function f(u: U): number {\n    switch (u) {\n        case "a":\n            return 1;\n    }\n    return 0;\n}\n',
        expect: [
            {
                id: "@typescript-eslint/switch-exhaustiveness-check",
                severity: 2,
                line: 3,
                column: 13,
                text: "u",
                message: 'Switch is not exhaustive. Cases not matched: "b"',
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
