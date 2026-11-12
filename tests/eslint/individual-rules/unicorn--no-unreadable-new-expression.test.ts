import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("member access on a new expression is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-new-expression",
        "export const t = new Date().getTime();\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-unreadable-new-expression",
            line: 1,
            column: 29,
            text: "getTime",
            message: "Do not access members directly from a `new` expression.",
        },
    ]);
});

void test("naming the instance first is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-new-expression",
        "const date = new Date();\nexport const t = date.getTime();\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
