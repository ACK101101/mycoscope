import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("destructuring three levels deep is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-object-destructuring",
        "export function deep(o: { a: { b: { c: number } } }): number {\n    const { a: { b: { c } } } = o;\n    return c;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-unreadable-object-destructuring",
            line: 2,
            column: 21,
            text: "{ c }",
            message: "Do not use object destructuring deeper than two levels.",
        },
    ]);
});

void test("destructuring two levels deep is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-object-destructuring",
        "export function two(o: { a: { b: number } }): number {\n    const { a: { b } } = o;\n    return b;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
