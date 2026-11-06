import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("unicorn/no-unreadable-iife", [
    {
        name: "an IIFE with a parenthesized arrow body is reported",
        code: "export const n = (() => (1))();\n",
        expect: [
            {
                id: "unicorn/no-unreadable-iife",
                line: 1,
                column: 25,
                text: "(1)",
                message:
                    "IIFE with parenthesized arrow function body is considered unreadable.",
            },
        ],
    },
    {
        name: "an IIFE with a block body is allowed",
        code: "export const n = (() => {\n    return 1;\n})();\n",
        expect: [],
    },
]);
