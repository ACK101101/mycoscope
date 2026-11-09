import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint, type Linter } from "eslint";
import type { ReadonlyDeep } from "type-fest";
import {
    requireRuleCases,
    syntaxRestrictionSettings,
} from "./rule-coverage.ts";
import {
    offsetFromLocation,
    runCases,
    type TestCase,
    type ActualDiagnostic,
} from "./test-case.ts";

// Harness workaround: give in-memory source a path so ESLint applies Mycoscope's
// lint settings. No file is written. allowDefaultProject below lets the TypeScript
// project service use tsconfig.json for source outside the project.
const SNIPPET_PATH = "tests/snippets/case.ts";

function configuredRuleIds(config: unknown): readonly string[] {
    if (
        typeof config === "object" &&
        config !== null &&
        "rules" in config &&
        typeof config.rules === "object" &&
        config.rules !== null
    ) {
        return Object.keys(config.rules);
    }
    throw new Error("calculateConfigForFile returned no rules");
}

// Load Mycoscope's ESLint config and disable every rule except the one under test.
// Keep that rule's configured options and severity.
async function createSingleRuleLinter(
    ruleId: string,
    checkUnusedDisables = false,
    selector?: string,
): Promise<ESLint> {
    const engine = new ESLint({ ignore: false });
    const config: unknown = await engine.calculateConfigForFile(SNIPPET_PATH);
    const rules = configuredRuleIds(config);
    if (!rules.includes(ruleId)) {
        throw new Error(`${ruleId} is not configured in eslint.config.js`);
    }
    const restrictionSettings =
        selector === undefined ? undefined : syntaxRestrictionSettings(config);
    const restriction = restrictionSettings?.restrictions.find(
        (option) => option.selector === selector,
    );
    if (selector !== undefined && restriction === undefined)
        throw new Error(`Syntax selector is not configured: ${selector}`);
    return new ESLint({
        ignore: false,
        overrideConfig: [
            {
                // Disabling rules can make their suppression comments appear unused.
                // Test unused-disable reporting separately with its configured severity.
                linterOptions: checkUnusedDisables
                    ? {}
                    : { reportUnusedDisableDirectives: "off" },
                languageOptions: {
                    parserOptions: {
                        projectService: {
                            allowDefaultProject: ["tests/snippets/*.ts"],
                        },
                    },
                },
                rules: {
                    ...Object.fromEntries(
                        rules
                            .filter((rule) => rule !== ruleId)
                            .map((rule) => [rule, "off" as const]),
                    ),
                    // A rejection must come from the declared selector.
                    ...(restriction === undefined ||
                    restrictionSettings === undefined
                        ? {}
                        : {
                              "no-restricted-syntax": [
                                  restrictionSettings.severity,
                                  restriction,
                              ],
                          }),
                },
            },
        ],
    });
}

function toActualDiagnostic(
    code: string,
    message: ReadonlyDeep<Linter.LintMessage>,
): ActualDiagnostic {
    const start = offsetFromLocation(code, message.line, message.column);
    const end =
        message.endLine === undefined || message.endColumn === undefined
            ? start
            : offsetFromLocation(code, message.endLine, message.endColumn);
    return {
        id: message.ruleId ?? "(no rule)",
        line: message.line,
        column: message.column,
        text: code.slice(start, end),
        severity: message.severity,
        message: message.message,
    };
}

export function testLintRule(ruleId: string, cases: readonly TestCase[]): void {
    requireRuleCases(ruleId, cases);
    runLintCases(ruleId, cases, createSingleRuleLinter(ruleId));
}

export function testSyntaxRestriction(
    selector: string,
    cases: readonly TestCase[],
): void {
    requireRuleCases("no-restricted-syntax", cases);
    runLintCases(
        `no-restricted-syntax: ${selector}`,
        cases,
        createSingleRuleLinter("no-restricted-syntax", false, selector),
    );
}

// Unused-disable reporting is a linter option, not a rule. Keep the assertion rule
// active so these cases distinguish directives that suppress an error from unused ones.
export function testUnusedDisableDirectives(cases: readonly TestCase[]): void {
    runLintCases(
        "reportUnusedDisableDirectives",
        cases,
        createSingleRuleLinter(
            "@typescript-eslint/consistent-type-assertions",
            true,
        ),
    );
}

function runLintCases(
    suite: string,
    cases: readonly TestCase[],
    engine: Promise<ESLint>,
): void {
    runCases(suite, cases, async (code) => {
        const result = await lintSource(engine, code);
        return result.messages.map(
            (message: ReadonlyDeep<Linter.LintMessage>) =>
                toActualDiagnostic(code, message),
        );
    });
}

async function lintSource(
    engine: Promise<ESLint>,
    code: string,
): Promise<ESLint.LintResult> {
    const [result] = await (
        await engine
    ).lintText(code, { filePath: SNIPPET_PATH });
    if (result === undefined)
        throw new Error(`ESLint returned no result for ${SNIPPET_PATH}`);
    return result;
}

// Preset examples check the rule identity without fixing message text or locations.
export function testLintExamples(
    ruleId: string,
    rejected: string,
    accepted: string,
): void {
    testLintPair(ruleId, rejected, accepted, (messages) => {
        assert.ok(
            messages.length > 0,
            `${ruleId} did not reject its violation`,
        );
        assert.ok(
            messages.every((message) => message.ruleId === ruleId),
            JSON.stringify(messages),
        );
    });
}

// A parser rejection protects this syntax but is not evidence that the ESLint rule ran.
export function testParserRejection(
    ruleId: string,
    rejected: string,
    accepted: string,
): void {
    testLintPair(ruleId, rejected, accepted, (messages) => {
        assert.ok(
            messages.some(
                (message) => message.fatal === true && message.ruleId === null,
            ),
            JSON.stringify(messages),
        );
    });
}

function testLintPair(
    ruleId: string,
    rejected: string,
    accepted: string,
    assertRejected: (
        messages: readonly ReadonlyDeep<Linter.LintMessage>[],
    ) => void,
): void {
    const engine = createSingleRuleLinter(ruleId);
    void test(`${ruleId} rejects its violation`, async () => {
        assertRejected((await lintSource(engine, rejected)).messages);
    });
    void test(`${ruleId} accepts its control`, async () => {
        assert.deepEqual((await lintSource(engine, accepted)).messages, []);
    });
}
