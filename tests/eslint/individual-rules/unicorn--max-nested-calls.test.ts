import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("unicorn/max-nested-calls", [
    {
        name: "calls nested four deep are reported",
        code: "const f = (n: number): number => n;\nexport const r = f(f(f(f(1))));\n",
        expect: [
            {
                id: "unicorn/max-nested-calls",
                line: 2,
                column: 24,
                text: "f(1)",
                message: "Call is nested too deeply. Maximum allowed is 3.",
            },
        ],
    },
    {
        name: "calls nested three deep are allowed",
        code: "const f = (n: number): number => n;\nexport const r = f(f(f(1)));\n",
        expect: [],
    },
]);
