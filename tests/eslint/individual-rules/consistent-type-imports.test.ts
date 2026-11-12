import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a type imported as a value is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/consistent-type-imports",
        'import { Linter } from "eslint";\nexport const level = (l: Linter.Severity): Linter.Severity => l;\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/consistent-type-imports",
            line: 1,
            column: 1,
            text: 'import { Linter } from "eslint";',
            message:
                "All imports in the declaration are only used as types. Use `import type`.",
        },
    ]);
});

void test("import type is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/consistent-type-imports",
        'import type { Linter } from "eslint";\nexport const level = (l: Linter.Severity): Linter.Severity => l;\n',
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("a value import is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/consistent-type-imports",
        'import { ESLint } from "eslint";\nexport const engine = (): ESLint => new ESLint();\n',
    );
    assertDiagnosticsMatch(diagnostics, []);
});
