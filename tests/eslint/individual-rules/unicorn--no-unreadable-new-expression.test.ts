import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("unicorn/no-unreadable-new-expression", [
    {
        name: "member access on a new expression is reported",
        code: "export const t = new Date().getTime();\n",
        expect: [
            {
                id: "unicorn/no-unreadable-new-expression",
                line: 1,
                column: 29,
                text: "getTime",
                message:
                    "Do not access members directly from a `new` expression.",
            },
        ],
    },
    {
        name: "naming the instance first is allowed",
        code: "const date = new Date();\nexport const t = date.getTime();\n",
        expect: [],
    },
]);
