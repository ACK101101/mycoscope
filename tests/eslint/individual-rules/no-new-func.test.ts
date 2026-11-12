import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("the Function constructor is reported", async () => {
    const diagnostics = await lintRule(
        "no-new-func",
        'export const make = new Function("return 1");\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-new-func",
            severity: 2,
            line: 1,
            column: 21,
            text: 'new Function("return 1")',
            message: "The Function constructor is eval.",
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "no-new-func",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
