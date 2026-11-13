import { test } from "node:test";
import { lintUnusedDisableDirectives } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a directive that suppresses no diagnostic is reported", async () => {
    const diagnostics = await lintUnusedDisableDirectives(
        "export function f(x: string): string {\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- nothing here to suppress\n    return x;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "(no rule)",
            severity: 2,
            line: 2,
            column: 5,
            text: "",
            message:
                "Unused eslint-disable directive (no problems were reported from '@typescript-eslint/consistent-type-assertions').",
        },
    ]);
});

void test("a directive that suppresses an assertion is allowed", async () => {
    const diagnostics = await lintUnusedDisableDirectives(
        "export function f(x: unknown): string {\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixture: reasoned disable is allowed\n    return x as string;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("source without disable directives is allowed", async () => {
    const diagnostics = await lintUnusedDisableDirectives(
        "export function f(x: number): number {\n    return x + 1;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
