import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("an else after a return is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-useless-else",
        "export function pick(a: boolean): number {\n    if (a) {\n        return 1;\n    } else {\n        return 2;\n    }\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-useless-else",
            line: 4,
            column: 7,
            text: "else",
            message: "Unexpected `else` after a statement that exits.",
        },
    ]);
});

void test("code after the if is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-useless-else",
        "export function pick(a: boolean): number {\n    if (a) {\n        return 1;\n    }\n    return 2;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("an else after a branch that does not exit is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-useless-else",
        "export function pick(a: boolean): number {\n    let n = 0;\n    if (a) {\n        n = 1;\n    } else {\n        n = 2;\n    }\n    return n;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
