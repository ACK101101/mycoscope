import { assertBehaviorEqual } from "./behavior.ts";
import { test } from "node:test";
import { ESLint, type Linter } from "eslint";
import type { ReadonlyDeep } from "type-fest";
import { offsetOf, runCases, type Case, type Found } from "./case.ts";

// An in-project placeholder: lintText supplies fresh text while the project service
// reuses its small project and the real compiler options inherited from the root.
const SNIPPET = "tests/snippets/case.ts";

function configuredRules(config: unknown): readonly string[] {
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

// The real eslint.config.js with every rule but one switched off. Options and severity of
// the rule under test are the real ones, so a test can not drift from the config.
async function isolated(ruleId: string): Promise<ESLint> {
    const engine = new ESLint({ ignore: false });
    const config: unknown = await engine.calculateConfigForFile(SNIPPET);
    const rules = configuredRules(config);
    // An absent rule is valid baseline behavior: emit no target diagnostic, then let the
    // case assertion distinguish it from the candidate. Setup failure is not RED evidence.
    return new ESLint({
        ignore: false,
        overrideConfig: [
            {
                rules: Object.fromEntries(
                    rules
                        .filter((rule) => rule !== ruleId)
                        .map((rule) => [rule, "off" as const]),
                ),
            },
        ],
    });
}

function requireParsed(messages: readonly Linter.LintMessage[]): void {
    const fatal = messages.find((message) => message.fatal === true);
    if (fatal !== undefined)
        throw new Error(`Parser setup failure: ${fatal.message}`);
}

function toFound(code: string, m: ReadonlyDeep<Linter.LintMessage>): Found {
    const start = offsetOf(code, m.line, m.column);
    const end =
        m.endLine === undefined || m.endColumn === undefined
            ? start
            : offsetOf(code, m.endLine, m.endColumn);
    return {
        id: m.ruleId ?? "(no rule)",
        line: m.line,
        column: m.column,
        text: code.slice(start, end),
        message: m.message,
    };
}

export function lintRule(ruleId: string, cases: readonly Case[]): void {
    const engine = isolated(ruleId);
    runCases(ruleId, cases, async (code) => {
        const [result] = await (
            await engine
        ).lintText(code, { filePath: SNIPPET });
        if (result === undefined) throw new Error("ESLint returned no result.");
        requireParsed(result.messages);
        return result.messages.map((m: ReadonlyDeep<Linter.LintMessage>) =>
            toFound(code, m),
        );
    });
}

// Preset smoke tests pin our actual configuration, without duplicating upstream's
// complete rule suites. Every enabled rule must reject a violation and accept a control.
export function lintExamples(
    ruleId: string,
    invalid: string,
    valid: string,
    parserRejects = false,
): void {
    const engine = isolated(ruleId);
    void test(`${ruleId} rejects its configured violation`, async () => {
        const [result] = await (
            await engine
        ).lintText(invalid, { filePath: SNIPPET });
        if (result === undefined) throw new Error("ESLint returned no result.");
        if (!parserRejects) requireParsed(result.messages);
        if (parserRejects) {
            assertBehaviorEqual(
                result.messages.some(
                    (message) =>
                        message.fatal === true && message.ruleId === null,
                ),
                true,
            );
        } else {
            assertBehaviorEqual(
                result.messages.some((message) => message.ruleId === ruleId),
                true,
            );
            assertBehaviorEqual(
                result.messages.every((message) => message.ruleId === ruleId),
                true,
            );
        }
    });
    void test(`${ruleId} accepts its control`, async () => {
        const [result] = await (
            await engine
        ).lintText(valid, { filePath: SNIPPET });
        if (result === undefined) throw new Error("ESLint returned no result.");
        requireParsed(result.messages);
        assertBehaviorEqual(result.messages, []);
    });
}

// TypeScript rejects legacy octal syntax before ESLint can visit it. Pin that
// stronger parser rejection rather than weakening the parser just for these tests.
export function lintParserExamples(
    ruleId: string,
    invalid: string,
    valid: string,
): void {
    lintExamples(ruleId, invalid, valid, true);
}
