import assert from "node:assert/strict";
import { after, test } from "node:test";
import { ESLint } from "eslint";
import { lintCoverage } from "../harness/lint-adapter.ts";
import {
    diagnosticCoverage,
    missingDiagnosticCoverage,
    syntaxRestrictionSettings,
    type DiagnosticCoverage,
} from "../harness/rule-coverage.ts";
import type { ActualDiagnostic } from "../harness/diagnostics.ts";

// TypeScript's parser rejects these constructs before their disabled ESLint rules run.
const PARSER_RESTRICTIONS = ["no-octal", "no-nonoctal-decimal-escape"];

// npm test loads all test files in one process. Check their results after the
// behavior tests finish. Focused runs intentionally omit cases.
after(async () => {
    if (
        process.execArgv.some((argument) =>
            /^--test-(?:name-pattern|skip-pattern|only)(?:=|$)/.test(argument),
        )
    )
        return;
    try {
        const engine = new ESLint();
        const config: unknown =
            await engine.calculateConfigForFile("src/index.ts");
        assert.ok(
            typeof config === "object" && config !== null && "rules" in config,
        );
        assert.ok(typeof config.rules === "object" && config.rules !== null);
        const enabled = Object.entries(config.rules).flatMap(
            ([rule, setting]: readonly [string, unknown]) => {
                assert.ok(Array.isArray(setting));
                const values: readonly unknown[] = setting;
                return values[0] === 0 || values[0] === "off" ? [] : [rule];
            },
        );
        const observed = lintCoverage();
        const selectors = syntaxRestrictionSettings(config).restrictions.map(
            ({ selector }) => selector,
        );
        assert.deepEqual(
            missingDiagnosticCoverage(selectors, "syntax", observed),
            [],
            "Configured syntax selectors need rejection and acceptance coverage",
        );
        // Every selector must pass independently; a generic rule test cannot substitute.
        assert.deepEqual(
            missingDiagnosticCoverage(
                enabled.filter((rule) => rule !== "no-restricted-syntax"),
                "rule",
                observed,
            ),
            [],
            "Enabled rules need rejection and acceptance coverage",
        );
        assert.deepEqual(
            missingDiagnosticCoverage(PARSER_RESTRICTIONS, "parser", observed),
            [],
            "Parser restrictions need rejection and acceptance coverage",
        );
        for (const rule of PARSER_RESTRICTIONS)
            assert.ok(
                !enabled.includes(rule),
                `${rule} must remain disabled; parser rejection is not rule coverage`,
            );
    } catch (error) {
        // Node workaround: --test-isolation=none can report a failed root hook
        // with exit code 0. Set a failing exit code before rethrowing.
        process.exitCode = 1;
        throw error;
    }
});

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
