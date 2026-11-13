import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a complex iterable in the loop header is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-for-of-expression",
        "export function inner(xs: number[]): number[] {\n    const out: number[] = [];\n    for (const x of xs.slice(1, xs.length - 1)) {\n        out.push(x);\n    }\n    return out;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-unreadable-for-of-expression",
            line: 3,
            column: 21,
            text: "xs.slice(1, xs.length - 1)",
        },
    ]);
});

void test("a named iterable is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-for-of-expression",
        "export function copy(xs: number[]): number[] {\n    const out: number[] = [];\n    for (const x of xs) {\n        out.push(x);\n    }\n    return out;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
