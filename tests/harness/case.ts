import { assertBehaviorEqual } from "./behavior.ts";
import { describe, test } from "node:test";

// One case shape for both backends.
// A lint case enables one rule and `id` is its name,
// a tsc case sets one compiler option and `id` is the diagnostic code (`TS7006`).
// `text` is the source the error points at, so a case survives edits elsewhere in its snippet.
export interface Expected {
    readonly id: string;
    readonly line: number;
    readonly column: number;
    readonly text: string;
    // Pin when the exact wording matters; omit when the id already says everything.
    readonly message?: string;
}

export interface Found extends Expected {
    readonly message: string;
}

export interface Case {
    readonly name: string;
    readonly code: string;
    // Empty means the snippet must be silent.
    readonly expect: readonly Expected[];
}

type Position = Pick<Expected, "id" | "line" | "column" | "text">;

function position({ id, line, column, text }: Expected): Position {
    return { id, line, column, text };
}

// 1-based line and column, as both ESLint and the TypeScript API report them.
export function offsetOf(code: string, line: number, column: number): number {
    const rowsBefore = code.split("\n").slice(0, line - 1);
    let lineStart = 0;
    for (const row of rowsBefore) {
        lineStart += row.length + 1;
    }
    return lineStart + column - 1;
}

// The inverse of offsetOf.
export function locate(
    code: string,
    offset: number,
): Pick<Expected, "line" | "column"> {
    const before = code.slice(0, offset);
    const lineStart = before.lastIndexOf("\n") + 1;
    return {
        line: before.split("\n").length,
        column: offset - lineStart + 1,
    };
}

export function assertFound(
    found: readonly Found[],
    expect: readonly Expected[],
): void {
    assertBehaviorEqual(
        found.map((f) => position(f)),
        expect.map((e) => position(e)),
    );
    for (const [i, want] of expect.entries()) {
        if (want.message !== undefined) {
            assertBehaviorEqual(found[i]?.message ?? null, want.message);
        }
    }
}

export function runCases(
    suite: string,
    cases: readonly Case[],
    run: (code: string) => Promise<readonly Found[]>,
): void {
    void describe(suite, () => {
        for (const { name, code, expect } of cases) {
            void test(name, async () => {
                assertFound(await run(code), expect);
            });
        }
    });
}
