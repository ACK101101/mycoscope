import { ESLint, type Linter } from "eslint";
import type { ReadonlyDeep } from "type-fest";
import {
    offsetFromLocation,
    runCases,
    type TestCase,
    type ActualDiagnostic,
} from "./case.ts";

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
async function createSingleRuleLinter(ruleId: string): Promise<ESLint> {
    const engine = new ESLint({ ignore: false });
    const config: unknown = await engine.calculateConfigForFile(SNIPPET_PATH);
    const rules = configuredRuleIds(config);
    if (!rules.includes(ruleId)) {
        throw new Error(`${ruleId} is not configured in eslint.config.js`);
    }
    return new ESLint({
        ignore: false,
        overrideConfig: [
            {
                languageOptions: {
                    parserOptions: {
                        projectService: {
                            allowDefaultProject: ["tests/snippets/*.ts"],
                        },
                    },
                },
                rules: Object.fromEntries(
                    rules
                        .filter((rule) => rule !== ruleId)
                        .map((rule) => [rule, "off" as const]),
                ),
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
        message: message.message,
    };
}

export function testLintRule(ruleId: string, cases: readonly TestCase[]): void {
    const engine = createSingleRuleLinter(ruleId);
    runCases(ruleId, cases, async (code) => {
        const [result] = await (
            await engine
        ).lintText(code, { filePath: SNIPPET_PATH });
        return (result?.messages ?? []).map(
            (message: ReadonlyDeep<Linter.LintMessage>) =>
                toActualDiagnostic(code, message),
        );
    });
}
