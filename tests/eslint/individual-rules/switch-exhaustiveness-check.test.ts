import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a switch with a missing union member is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/switch-exhaustiveness-check",
        'type U = "a" | "b";\nexport function f(u: U): number {\n    switch (u) {\n        case "a":\n            return 1;\n    }\n    return 0;\n}\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/switch-exhaustiveness-check",
            severity: 2,
            line: 3,
            column: 13,
            text: "u",
            message: 'Switch is not exhaustive. Cases not matched: "b"',
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/switch-exhaustiveness-check",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
