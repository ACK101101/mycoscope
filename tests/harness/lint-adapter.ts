import { ESLint, type Linter } from "eslint";
import type { ReadonlyDeep } from "type-fest";
import {
    diagnosticCoverage,
    type DiagnosticCoverage,
    syntaxRestrictionSettings,
} from "./rule-coverage.ts";
import { offsetFromLocation, type ActualDiagnostic } from "./diagnostics.ts";

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
        ...(message.fatal === undefined ? {} : { fatal: message.fatal }),
    };
}

const engines: Map<string, Promise<ESLint>> = new Map<
    string,
    Promise<ESLint>
>();
const coverage: DiagnosticCoverage[] = [];

export function lintCoverage(): readonly DiagnosticCoverage[] {
    return [...coverage];
}

export function lintRule(
    ruleId: string,
    code: string,
): Promise<readonly ActualDiagnostic[]> {
    return lintSource(ruleId, code, "rule");
}

export function lintSyntaxRestriction(
    selector: string,
    code: string,
): Promise<readonly ActualDiagnostic[]> {
    return lintSource("no-restricted-syntax", code, "syntax", selector);
}

// The TypeScript parser rejects these constructs before ESLint can run a rule.
export function lintParserRestriction(
    ruleId: string,
    code: string,
): Promise<readonly ActualDiagnostic[]> {
    return lintSource(ruleId, code, "parser");
}

// Keep the assertion rule active to distinguish useful directives from unused ones.
export function lintUnusedDisableDirectives(
    code: string,
): Promise<readonly ActualDiagnostic[]> {
    return lintSource(
        "@typescript-eslint/consistent-type-assertions",
        code,
        undefined,
        undefined,
        true,
    );
}

async function lintSource(
    ruleId: string,
    code: string,
    kind?: DiagnosticCoverage["kind"],
    selector?: string,
    checkUnusedDisables = false,
): Promise<readonly ActualDiagnostic[]> {
    const key = JSON.stringify([ruleId, selector, checkUnusedDisables]);
    const engine =
        engines.get(key) ??
        createSingleRuleLinter(ruleId, checkUnusedDisables, selector);
    engines.set(key, engine);
    const [result] = await (
        await engine
    ).lintText(code, { filePath: SNIPPET_PATH });
    if (result === undefined)
        throw new Error(`ESLint returned no result for ${SNIPPET_PATH}`);
    const diagnostics = result.messages.map(
        (message: ReadonlyDeep<Linter.LintMessage>) =>
            toActualDiagnostic(code, message),
    );
    if (kind !== undefined) {
        const observed = diagnosticCoverage(
            kind,
            selector ?? ruleId,
            diagnostics,
        );
        if (observed !== undefined) coverage.push(observed);
    }
    return diagnostics;
}
