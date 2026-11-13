import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("!! is reported", async () => {
    const diagnostics = await lintRule(
        "no-implicit-coercion",
        "export const flag = (s: string): boolean => !!s;\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-implicit-coercion",
            line: 1,
            column: 45,
            text: "!!s",
        },
    ]);
});

void test("unary + is reported", async () => {
    const diagnostics = await lintRule(
        "no-implicit-coercion",
        "export const num = (s: string): number => +s;\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-implicit-coercion",
            line: 1,
            column: 43,
            text: "+s",
        },
    ]);
});

void test("Boolean() and Number() are allowed", async () => {
    const diagnostics = await lintRule(
        "no-implicit-coercion",
        "export const both = (s: string): [boolean, number] => [Boolean(s), Number(s)];\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
