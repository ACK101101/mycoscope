import assert from "node:assert/strict";
import type { ActualDiagnostic } from "./diagnostics.ts";

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

export interface DiagnosticCoverage {
    readonly kind: "rule" | "syntax" | "parser";
    readonly id: string;
    readonly outcome: "rejection" | "acceptance";
}

// Count actual tool results. Parser failures and unrelated rules cannot establish
// rejection coverage for an ESLint rule or a syntax selector.
export function diagnosticCoverage(
    kind: DiagnosticCoverage["kind"],
    id: string,
    diagnostics: readonly ActualDiagnostic[],
): DiagnosticCoverage | undefined {
    if (diagnostics.length === 0) return { kind, id, outcome: "acceptance" };
    const ruleId = kind === "syntax" ? "no-restricted-syntax" : id;
    const rejected =
        kind === "parser"
            ? diagnostics.some(
                  (diagnostic) =>
                      diagnostic.fatal === true &&
                      diagnostic.id === "(no rule)",
              )
            : diagnostics.every(
                  (diagnostic) =>
                      diagnostic.fatal !== true && diagnostic.id === ruleId,
              );
    return rejected ? { kind, id, outcome: "rejection" } : undefined;
}

export function missingDiagnosticCoverage(
    required: readonly string[],
    kind: DiagnosticCoverage["kind"],
    observed: readonly DiagnosticCoverage[],
): readonly string[] {
    return required
        .filter(
            (id) =>
                !["rejection", "acceptance"].every((outcome) =>
                    observed.some(
                        (entry) =>
                            entry.kind === kind &&
                            entry.id === id &&
                            entry.outcome === outcome,
                    ),
                ),
        )
        .toSorted();
}
