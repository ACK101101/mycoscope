import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a ternary inside a ternary is reported", async () => {
    const diagnostics = await lintRule(
        "no-nested-ternary",
        'export const label = (n: number): string => n > 0 ? "pos" : n < 0 ? "neg" : "zero";\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-nested-ternary",
            line: 1,
            column: 45,
            text: 'n > 0 ? "pos" : n < 0 ? "neg" : "zero"',
            message: "Do not nest ternary expressions.",
        },
    ]);
});

void test("a single ternary is allowed", async () => {
    const diagnostics = await lintRule(
        "no-nested-ternary",
        'export const label = (n: number): string => n > 0 ? "pos" : "other";\n',
    );
    assertDiagnosticsMatch(diagnostics, []);
});
