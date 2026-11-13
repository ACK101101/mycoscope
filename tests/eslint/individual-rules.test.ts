import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { describe, test } from "node:test";
import { ESLint } from "eslint";
import { lintCoverage } from "../harness/lint-adapter.ts";
import {
    missingDiagnosticCoverage,
    syntaxRestrictionSettings,
} from "../harness/rule-coverage.ts";

// Run serially so the final test checks results from every rule file.
void describe("ESLint individual rules", { concurrency: false }, async () => {
    const directory = new URL("./individual-rules/", import.meta.url);
    const files = (await readdir(directory))
        .filter((file) => file.endsWith(".test.ts"))
        .sort();
    for (const file of files) {
        const path = new URL(file, directory);
        // eslint-disable-next-line no-restricted-syntax -- Loading the rule files here makes their callbacks and final coverage check belong to this suite.
        await import(path.href);
    }

    void test(
        "every enabled rule and selector has rejection and acceptance coverage",
        {
            // Native test selection intentionally omits cases. Check coverage on full runs.
            skip: process.execArgv.some((argument) =>
                /^--test-(?:name-pattern|skip-pattern|only)(?:=|$)/.test(
                    argument,
                ),
            ),
        },
        async () => {
            // TypeScript's parser rejects these constructs before their disabled ESLint rules run.
            const PARSER_RESTRICTIONS = [
                "no-octal",
                "no-nonoctal-decimal-escape",
            ];
            const engine = new ESLint();
            const config: unknown =
                await engine.calculateConfigForFile("src/index.ts");
            assert.ok(
                typeof config === "object" &&
                    config !== null &&
                    "rules" in config,
            );
            assert.ok(
                typeof config.rules === "object" && config.rules !== null,
            );
            const enabled = Object.entries(config.rules).flatMap(
                ([rule, setting]: readonly [string, unknown]) => {
                    assert.ok(Array.isArray(setting));
                    const values: readonly unknown[] = setting;
                    return values[0] === 0 || values[0] === "off" ? [] : [rule];
                },
            );
            const observed = lintCoverage();
            const selectors = syntaxRestrictionSettings(
                config,
            ).restrictions.map(({ selector }) => selector);
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
                missingDiagnosticCoverage(
                    PARSER_RESTRICTIONS,
                    "parser",
                    observed,
                ),
                [],
                "Parser restrictions need rejection and acceptance coverage",
            );
            for (const rule of PARSER_RESTRICTIONS)
                assert.ok(
                    !enabled.includes(rule),
                    `${rule} must remain disabled; parser rejection is not rule coverage`,
                );
        },
    );
});
