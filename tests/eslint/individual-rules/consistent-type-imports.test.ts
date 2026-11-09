import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/consistent-type-imports", [
    {
        name: "a type imported as a value is reported",
        code: 'import { Linter } from "eslint";\nexport const level = (l: Linter.Severity): Linter.Severity => l;\n',
        expect: [
            {
                id: "@typescript-eslint/consistent-type-imports",
                line: 1,
                column: 1,
                text: 'import { Linter } from "eslint";',
                message:
                    "All imports in the declaration are only used as types. Use `import type`.",
            },
        ],
    },
    {
        name: "import type is allowed",
        code: 'import type { Linter } from "eslint";\nexport const level = (l: Linter.Severity): Linter.Severity => l;\n',
        expect: [],
    },
    {
        name: "a value import is allowed",
        code: 'import { ESLint } from "eslint";\nexport const engine = (): ESLint => new ESLint();\n',
        expect: [],
    },
]);
