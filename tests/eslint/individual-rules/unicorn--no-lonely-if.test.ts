import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("an if that is the only statement of an if is reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-lonely-if",
        "export function both(a: boolean, b: boolean): number {\n    if (a) {\n        if (b) {\n            return 1;\n        }\n    }\n    return 0;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-lonely-if",
            line: 3,
            column: 9,
            text: "if (b) {\n            return 1;\n        }",
            message:
                "Unexpected `if` as the only statement in a `if` block without `else`.",
        },
    ]);
});

void test("a combined condition is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-lonely-if",
        "export function both(a: boolean, b: boolean): number {\n    if (a && b) {\n        return 1;\n    }\n    return 0;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("an inner if next to another statement is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-lonely-if",
        "export function both(a: boolean, b: boolean): number {\n    if (a) {\n        const n = 1;\n        if (b) {\n            return n;\n        }\n    }\n    return 0;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
