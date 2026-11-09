import assert from "node:assert/strict";
import ts from "typescript";
import type { TestCase } from "./test-case.ts";

export interface RuleTestRegistrations {
    readonly rules: readonly string[];
    readonly syntaxSelectors: readonly string[];
    readonly parserRestrictions: readonly string[];
}

export interface SyntaxRestriction {
    readonly selector: string;
    readonly message?: string;
}

export interface SyntaxRestrictionSettings {
    readonly severity: 1 | 2;
    readonly restrictions: readonly SyntaxRestriction[];
}

export function syntaxRestrictionSettings(
    config: unknown,
): SyntaxRestrictionSettings {
    assert.ok(
        typeof config === "object" && config !== null && "rules" in config,
    );
    assert.ok(typeof config.rules === "object" && config.rules !== null);
    const setting: unknown = Object.entries(config.rules).find(
        ([rule]) => rule === "no-restricted-syntax",
    )?.[1];
    assert.ok(
        Array.isArray(setting),
        "no-restricted-syntax must be configured",
    );
    const values: readonly unknown[] = setting;
    const severity = values[0];
    assert.ok(
        severity === 1 || severity === 2,
        "no-restricted-syntax must be enabled",
    );
    const restrictions = values.slice(1).map((option) => {
        if (typeof option === "string") return { selector: option };
        assert.ok(
            typeof option === "object" &&
                option !== null &&
                "selector" in option,
        );
        assert.ok(typeof option.selector === "string");
        if (!("message" in option)) return { selector: option.selector };
        assert.ok(typeof option.message === "string");
        return { selector: option.selector, message: option.message };
    });
    return { severity, restrictions };
}

export function requireRuleCases(
    ruleId: string,
    cases: readonly TestCase[],
): void {
    assert.ok(
        cases.some(({ expect }) => expect.some(({ id }) => id === ruleId)),
        `${ruleId} needs a rejection case expecting that rule's diagnostic`,
    );
    assert.ok(
        cases.some(({ expect }) => expect.length === 0),
        `${ruleId} needs an acceptance case expecting no diagnostics`,
    );
}

// Only count direct calls to imported harness functions at module scope.
// Strings, skipped callbacks, and unused functions do not register behavior tests.
export function registeredRuleTests(text: string): RuleTestRegistrations {
    const source = ts.createSourceFile(
        "test.ts",
        text,
        ts.ScriptTarget.Latest,
        true,
    );
    const imports: Map<string, string> = new Map<string, string>();
    const constants: Map<string, string> = new Map<string, string>();
    const rules: Set<string> = new Set<string>();
    const syntaxSelectors: Set<string> = new Set<string>();
    const parserRestrictions: Set<string> = new Set<string>();
    const stringValue = (node: ts.Node | undefined): string | undefined => {
        if (node === undefined) return undefined;
        if (ts.isStringLiteralLike(node)) return node.text;
        if (ts.isIdentifier(node)) return constants.get(node.text);
        return undefined;
    };
    for (const statement of source.statements) {
        if (
            ts.isImportDeclaration(statement) &&
            ts.isStringLiteral(statement.moduleSpecifier) &&
            statement.moduleSpecifier.text.endsWith("/harness/lint-adapter.ts")
        ) {
            const bindings = statement.importClause?.namedBindings;
            if (bindings !== undefined && ts.isNamedImports(bindings)) {
                for (const binding of bindings.elements) {
                    imports.set(
                        binding.name.text,
                        binding.propertyName?.text ?? binding.name.text,
                    );
                }
            }
        }
        if (
            ts.isVariableStatement(statement) &&
            statement.declarationList.flags === ts.NodeFlags.Const
        ) {
            for (const declaration of statement.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name)) {
                    const value = stringValue(declaration.initializer);
                    if (value !== undefined)
                        constants.set(declaration.name.text, value);
                }
            }
        }
        if (
            !ts.isExpressionStatement(statement) ||
            !ts.isCallExpression(statement.expression)
        )
            continue;
        const call = statement.expression;
        if (!ts.isIdentifier(call.expression)) continue;
        const helper = imports.get(call.expression.text);
        const registrationId = stringValue(call.arguments[0]);
        if (registrationId === undefined) continue;
        if (helper === "testLintRule" || helper === "testSyntaxRestriction") {
            const cases = call.arguments[1];
            if (
                cases !== undefined &&
                ts.isArrayLiteralExpression(cases) &&
                cases.elements.length > 0
            ) {
                if (helper === "testSyntaxRestriction") {
                    syntaxSelectors.add(registrationId);
                    rules.add("no-restricted-syntax");
                } else rules.add(registrationId);
            }
        }
        if (helper === "testLintExamples" || helper === "testParserRejection") {
            const rejected = call.arguments[1];
            const accepted = call.arguments[2];
            if (rejected === undefined || accepted === undefined) continue;
            if (helper === "testLintExamples") rules.add(registrationId);
            else parserRestrictions.add(registrationId);
        }
    }
    return {
        rules: [...rules],
        parserRestrictions: [...parserRestrictions],
        syntaxSelectors: [...syntaxSelectors],
    };
}

export function missingRuleTests(
    enabled: readonly string[],
    registered: readonly string[],
): readonly string[] {
    return enabled.filter((rule) => !registered.includes(rule)).toSorted();
}
