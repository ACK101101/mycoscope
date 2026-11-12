import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("consecutive ignored elements are reported", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-array-destructuring",
        "export function third(xs: number[]): number | undefined {\n    const [,, x] = xs;\n    return x;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "unicorn/no-unreadable-array-destructuring",
            line: 2,
            column: 11,
            text: "[,, x]",
            message:
                "Array destructuring may not contain consecutive ignored values.",
        },
    ]);
});

void test("a single ignored element is allowed", async () => {
    const diagnostics = await lintRule(
        "unicorn/no-unreadable-array-destructuring",
        "export function second(xs: number[]): number | undefined {\n    const [, x] = xs;\n    return x;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
