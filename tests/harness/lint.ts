import { ESLint, type Linter } from "eslint";
import type { ReadonlyDeep } from "type-fest";
import { offsetOf, runCases, type Case, type Found } from "./case.ts";

// A path that does not exist on disk: ESLint lints the text we pass, and the project service
// types it through allowDefaultProject using the real tsconfig.json.
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
        return (result?.messages ?? []).map(
            (m: ReadonlyDeep<Linter.LintMessage>) => toFound(code, m),
        );
    });
}
