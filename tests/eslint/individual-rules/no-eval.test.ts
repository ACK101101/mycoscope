import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("eval is reported", async () => {
    const diagnostics = await lintRule(
        "no-eval",
        "export function f(s: string): unknown {\n    return eval(s);\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-eval",
            severity: 2,
            line: 2,
            column: 12,
            text: "eval",
            message: "`eval` can be harmful.",
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "no-eval",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
