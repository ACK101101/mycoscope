import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("ts-ignore is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/ban-ts-comment",
        '// @ts-ignore\nexport const n: number = "a";\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/ban-ts-comment",
            severity: 2,
            line: 1,
            column: 1,
            text: "// @ts-ignore",
            message:
                'Use "@ts-expect-error" instead of "@ts-ignore", as "@ts-ignore" will do nothing if the following line is error-free.',
        },
    ]);
});

void test("ts-expect-error without a description is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/ban-ts-comment",
        '// @ts-expect-error\nexport const n: number = "a";\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/ban-ts-comment",
            severity: 2,
            line: 1,
            column: 1,
            text: "// @ts-expect-error",
            message:
                'Include a description after the "@ts-expect-error" directive to explain why the @ts-expect-error is necessary. The description must be 3 characters or longer.',
        },
    ]);
});

void test("ts-nocheck is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/ban-ts-comment",
        "// @ts-nocheck\nexport const n: number = 1;\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/ban-ts-comment",
            severity: 2,
            line: 1,
            column: 1,
            text: "// @ts-nocheck",
            message:
                'Do not use "@ts-nocheck" because it alters compilation errors.',
        },
    ]);
});

void test("ts-check is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/ban-ts-comment",
        "// @ts-check\nexport const n: number = 1;\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/ban-ts-comment",
            severity: 2,
            line: 1,
            column: 1,
            text: "// @ts-check",
            message:
                'Do not use "@ts-check" because it alters compilation errors.',
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/ban-ts-comment",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
