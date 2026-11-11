import { assertBehaviorEqual } from "./behavior.ts";
import { describe, test } from "node:test";

// Both adapters use this format. `id` is an ESLint rule name or a TypeScript
// diagnostic code, such as TS7006. `text` is the source covered by the diagnostic.
export interface ExpectedDiagnostic {
    readonly id: string;
    readonly line: number;
    readonly column: number;
    readonly text: string;
    // Set this to check ESLint's severity: 1 is a warning and 2 is an error.
    readonly severity?: 1 | 2;
    // Set this to compare the exact message. Omit it to check only diagnostic identity.
    readonly message?: string;
}

export interface ActualDiagnostic extends ExpectedDiagnostic {
    readonly message: string;
}

export interface TestCase {
    readonly name: string;
    readonly code: string;
    // An empty array requires the snippet to produce no diagnostics.
    readonly expect: readonly ExpectedDiagnostic[];
}

// Compare the diagnostic ID, location, and source text separately from its message.
type DiagnosticIdentity = Pick<
    ExpectedDiagnostic,
    "id" | "line" | "column" | "text"
>;

function diagnosticIdentity({
    id,
    line,
    column,
    text,
}: ExpectedDiagnostic): DiagnosticIdentity {
    return { id, line, column, text };
}

// 1-based line and column, as both ESLint and the TypeScript API report them.
export function offsetFromLocation(
    code: string,
    line: number,
    column: number,
): number {
    const rowsBefore = code.split("\n").slice(0, line - 1);
    let lineStart = 0;
    for (const row of rowsBefore) {
        lineStart += row.length + 1;
    }
    return lineStart + column - 1;
}

// Convert a source offset to a 1-based line and column.
export function locationFromOffset(
    code: string,
    offset: number,
): Pick<ExpectedDiagnostic, "line" | "column"> {
    const before = code.slice(0, offset);
    const lineStart = before.lastIndexOf("\n") + 1;
    return {
        line: before.split("\n").length,
        column: offset - lineStart + 1,
    };
}

export function assertDiagnosticsMatch(
    actual: readonly ActualDiagnostic[],
    expected: readonly ExpectedDiagnostic[],
): void {
    assertBehaviorEqual(
        actual.map((diagnostic) => diagnosticIdentity(diagnostic)),
        expected.map((diagnostic) => diagnosticIdentity(diagnostic)),
    );
    for (const [i, want] of expected.entries()) {
        if (want.severity !== undefined) {
            assertBehaviorEqual(actual[i]?.severity ?? null, want.severity);
        }
        if (want.message !== undefined) {
            assertBehaviorEqual(actual[i]?.message ?? null, want.message);
        }
    }
}

export function runCases(
    suite: string,
    cases: readonly TestCase[],
    run: (code: string) => Promise<readonly ActualDiagnostic[]>,
): void {
    void describe(suite, () => {
        for (const { name, code, expect } of cases) {
            void test(name, async () => {
                assertDiagnosticsMatch(await run(code), expect);
            });
        }
    });
}
