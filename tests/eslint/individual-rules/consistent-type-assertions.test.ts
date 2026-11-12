import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a type assertion is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/consistent-type-assertions",
        "export function f(x: unknown): string {\n    return x as string;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/consistent-type-assertions",
            severity: 2,
            line: 2,
            column: 12,
            text: "x as string",
            message: "Do not use any type assertions.",
        },
    ]);
});

void test("a typed function is allowed", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/consistent-type-assertions",
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("a disable with a reason suppresses the assertion diagnostic", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/consistent-type-assertions",
        "export function f(x: unknown): string {\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixture: reasoned disable is allowed\n    return x as string;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
