import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("calls nested four deep are reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/max-nested-calls",
        "const f = (n: number): number => n;\nexport const r = f(f(f(f(1))));\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/max-nested-calls",
            line: 2,
            column: 24,
            text: "f(1)",
            message: "Call is nested too deeply. Maximum allowed is 3.",
        },
    ]);
});

void test("calls nested three deep are allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/max-nested-calls",
        "const f = (n: number): number => n;\nexport const r = f(f(f(1)));\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
