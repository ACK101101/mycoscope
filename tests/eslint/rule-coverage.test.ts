import assert from "node:assert/strict";
import { test } from "node:test";
import {
    diagnosticCoverage,
    missingDiagnosticCoverage,
    type DiagnosticCoverage,
} from "../harness/rule-coverage.ts";
import type { ActualDiagnostic } from "../harness/diagnostics.ts";

const REJECTION: ActualDiagnostic = {
    id: "no-debugger",
    line: 1,
    column: 1,
    text: "debugger;",
    message: "Unexpected 'debugger' statement.",
};

void test("coverage requires both rejection and acceptance results for every enabled rule", () => {
    const observed: readonly DiagnosticCoverage[] = [
        { kind: "rule", id: "no-debugger", outcome: "rejection" },
        { kind: "rule", id: "no-debugger", outcome: "acceptance" },
    ];
    assert.deepEqual(
        missingDiagnosticCoverage(
            ["no-debugger", "new-rule"],
            "rule",
            observed,
        ),
        ["new-rule"],
    );
    assert.deepEqual(
        missingDiagnosticCoverage(
            ["no-debugger"],
            "rule",
            observed.slice(0, 1),
        ),
        ["no-debugger"],
    );
    assert.deepEqual(
        missingDiagnosticCoverage(["no-debugger"], "rule", observed.slice(1)),
        ["no-debugger"],
    );
    assert.deepEqual(missingDiagnosticCoverage(["no-debugger"], "rule", []), [
        "no-debugger",
    ]);
});

void test("rule coverage distinguishes acceptance, target rejection, and unrelated diagnostics", () => {
    assert.deepEqual(diagnosticCoverage("rule", "no-debugger", []), {
        kind: "rule",
        id: "no-debugger",
        outcome: "acceptance",
    });
    assert.deepEqual(
        diagnosticCoverage("rule", "no-debugger", [REJECTION, REJECTION]),
        { kind: "rule", id: "no-debugger", outcome: "rejection" },
    );
    assert.equal(
        diagnosticCoverage("rule", "another-rule", [REJECTION]),
        undefined,
    );
    assert.equal(
        diagnosticCoverage("rule", "no-debugger", [
            REJECTION,
            { ...REJECTION, id: "another-rule" },
        ]),
        undefined,
    );
});

void test("parser failures cannot satisfy ESLint rule or selector coverage", () => {
    const diagnostics = [{ ...REJECTION, id: "(no rule)", fatal: true }];
    assert.equal(
        diagnosticCoverage("rule", "no-debugger", diagnostics),
        undefined,
    );
    assert.equal(
        diagnosticCoverage("syntax", "ImportExpression", diagnostics),
        undefined,
    );
    assert.deepEqual(diagnosticCoverage("parser", "no-octal", diagnostics), {
        kind: "parser",
        id: "no-octal",
        outcome: "rejection",
    });
    assert.equal(
        diagnosticCoverage("parser", "no-octal", [REJECTION]),
        undefined,
    );
});

void test("a rule pair or another selector cannot satisfy a syntax selector's coverage", () => {
    const observed: readonly DiagnosticCoverage[] = [
        { kind: "rule", id: "no-restricted-syntax", outcome: "rejection" },
        { kind: "rule", id: "no-restricted-syntax", outcome: "acceptance" },
        { kind: "syntax", id: "ImportExpression", outcome: "rejection" },
        { kind: "syntax", id: "ImportExpression", outcome: "acceptance" },
    ];
    assert.deepEqual(
        missingDiagnosticCoverage(
            ["ImportExpression", "ExportAllDeclaration"],
            "syntax",
            observed,
        ),
        ["ExportAllDeclaration"],
    );
    assert.deepEqual(
        diagnosticCoverage("syntax", "ImportExpression", [
            { ...REJECTION, id: "no-restricted-syntax" },
        ]),
        { kind: "syntax", id: "ImportExpression", outcome: "rejection" },
    );
    assert.equal(
        diagnosticCoverage("syntax", "ImportExpression", [REJECTION]),
        undefined,
    );
});
