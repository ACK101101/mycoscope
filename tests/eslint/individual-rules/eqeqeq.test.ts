import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("loose equality is reported", async () => {
    const diagnostics = await lintRule(
        "eqeqeq",
        "export const same = (a: number, b: number): boolean => a == b;\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "eqeqeq",
            line: 1,
            column: 58,
            text: "==",
            message: "Expected '===' and instead saw '=='.",
        },
    ]);
});

void test("loose equality against null is reported too", async () => {
    const diagnostics = await lintRule(
        "eqeqeq",
        "export const absent = (a: string | null): boolean => a == null;\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "eqeqeq",
            line: 1,
            column: 56,
            text: "==",
            message: "Expected '===' and instead saw '=='.",
        },
    ]);
});

void test("strict equality is allowed", async () => {
    const diagnostics = await lintRule(
        "eqeqeq",
        "export const same = (a: number, b: number): boolean => a === b;\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
