import { test } from "node:test";
import { compileWithOption } from "../../harness/tsc-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("an untyped parameter is implicitly any", () => {
    const diagnostics = compileWithOption(
        "noImplicitAny",
        "export function id(x) {\n    return x;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "TS7006",
            line: 1,
            column: 20,
            text: "x",
            message: "Parameter 'x' implicitly has an 'any' type.",
        },
    ]);
});

void test("each untyped parameter is reported, in source order", () => {
    const diagnostics = compileWithOption(
        "noImplicitAny",
        "export function pair(a, b) {\n    return [a, b];\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        { id: "TS7006", line: 1, column: 22, text: "a" },
        { id: "TS7006", line: 1, column: 25, text: "b" },
    ]);
});

void test("an untyped destructured parameter is reported per binding", () => {
    const diagnostics = compileWithOption(
        "noImplicitAny",
        "export function name({ first }) {\n    return first;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "TS7031",
            line: 1,
            column: 24,
            text: "first",
            message: "Binding element 'first' implicitly has an 'any' type.",
        },
    ]);
});

void test("an annotated parameter is fine", () => {
    const diagnostics = compileWithOption(
        "noImplicitAny",
        "export function id(x: number): number {\n    return x;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("an explicit any is allowed: the option bans implicit any only", () => {
    const diagnostics = compileWithOption(
        "noImplicitAny",
        "export function id(x: any): any {\n    return x;\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
