import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("forEach is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-for-each",
        "export function copy(xs: string[]): string[] {\n    const seen: string[] = [];\n    xs.forEach((x) => {\n        seen.push(x);\n    });\n    return seen;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-for-each",
            line: 3,
            column: 8,
            text: "forEach",
            message: "Use `for…of` instead of `.forEach(…)`.",
        },
    ]);
});

void test("a for...of loop is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-for-each",
        "export function copy(xs: string[]): string[] {\n    const seen: string[] = [];\n    for (const x of xs) {\n        seen.push(x);\n    }\n    return seen;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
