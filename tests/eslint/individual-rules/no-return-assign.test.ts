import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("assigning in a return is reported", async () => {
    const diagnostics = await lintRule(
        "no-return-assign",
        "export function set(): number {\n    let n = 0;\n    return n = 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-return-assign",
            line: 3,
            column: 5,
            text: "return n = 1;",
            message: "Return statement should not contain assignment.",
        },
    ]);
});

void test("assigning before returning is allowed", async () => {
    const diagnostics = await lintRule(
        "no-return-assign",
        "export function set(): number {\n    let n = 0;\n    n = 1;\n    return n;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
