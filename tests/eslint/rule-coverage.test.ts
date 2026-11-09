import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { ESLint } from "eslint";
import {
    missingRuleTests,
    registeredRuleTests,
    requireRuleCases,
} from "../harness/rule-coverage.ts";
import type { TestCase } from "../harness/test-case.ts";

// The corresponding ESLint rules are disabled because TypeScript's parser rejects
// these constructs. Parser tests must not satisfy enabled-rule coverage.
const PARSER_RESTRICTIONS = ["no-octal", "no-nonoctal-decimal-escape"];

void test("every enabled ESLint rule has rejection and acceptance coverage", async () => {
    const directory = "tests/eslint/individual-rules";
    const files = (await readdir(directory)).filter((file) =>
        file.endsWith(".test.ts"),
    );
    const registrations = await Promise.all(
        files.map(async (file) =>
            registeredRuleTests(await readFile(`${directory}/${file}`, "utf8")),
        ),
    );
    const rulesWithTests = registrations.flatMap(({ rules }) => rules);
    const parserTests = registrations.flatMap(
        ({ parserRestrictions }) => parserRestrictions,
    );
    const engine = new ESLint();
    const config: unknown = await engine.calculateConfigForFile("src/index.ts");
    assert.ok(
        typeof config === "object" && config !== null && "rules" in config,
    );
    assert.ok(typeof config.rules === "object" && config.rules !== null);
    const enabled = Object.entries(config.rules).flatMap(
        ([rule, setting]: [string, unknown]) => {
            assert.ok(Array.isArray(setting));
            const values: readonly unknown[] = setting;
            return values[0] === 0 || values[0] === "off" ? [] : [rule];
        },
    );
    assert.deepEqual(
        missingRuleTests(enabled, rulesWithTests),
        [],
        "Enabled rules without rejection/acceptance tests",
    );
    assert.deepEqual(
        [...parserTests].sort(),
        [...PARSER_RESTRICTIONS].sort(),
        "Each parser restriction needs rejection and acceptance tests",
    );
    for (const rule of PARSER_RESTRICTIONS)
        assert.ok(
            !enabled.includes(rule),
            `${rule} must remain disabled; parser rejection is not rule coverage`,
        );
});

const IMPORT =
    'import { testLintRule, testLintExamples, testParserRejection } from "../../harness/lint-adapter.ts";';

void test("adding an enabled rule without tests fails coverage", () => {
    assert.deepEqual(missingRuleTests(["tested", "newRule"], ["tested"]), [
        "newRule",
    ]);
});

void test("unrelated strings, empty registrations, and unexecuted callbacks do not count", () => {
    for (const code of [
        'const rule = "no-debugger";',
        'testLintRule("no-debugger", []);',
        'function unused() { testLintExamples("no-debugger", "debugger;", "f();"); }',
        'test.skip("skipped", () => testLintExamples("no-debugger", "debugger;", "f();"));',
    ])
        assert.deepEqual(registeredRuleTests(IMPORT + code).rules, []);
    assert.deepEqual(
        registeredRuleTests(
            'testLintExamples("no-debugger", "debugger;", "f();");',
        ).rules,
        [],
    );
});

void test("literal and constant rule IDs register paired examples", () => {
    assert.deepEqual(
        registeredRuleTests(
            IMPORT +
                'const RULE = "no-debugger"; testLintExamples(RULE, "debugger;", "f();");',
        ).rules,
        ["no-debugger"],
    );
    assert.deepEqual(
        registeredRuleTests(
            IMPORT + 'testLintExamples("no-debugger", "debugger;");',
        ).rules,
        [],
    );
});

void test("parser rejections do not count as ESLint rule behavior", () => {
    assert.deepEqual(
        registeredRuleTests(
            IMPORT +
                'testParserRejection("no-octal", "const n = 071;", "const n = 0o71;");',
        ),
        { rules: [], parserRestrictions: ["no-octal"] },
    );
});

void test("paired source expressions register without evaluating test source", () => {
    assert.deepEqual(
        registeredRuleTests(
            IMPORT +
                'const PREFIX = "export "; testLintExamples("no-debugger", PREFIX + "debugger;", `${PREFIX}const n = 1;`);',
        ).rules,
        ["no-debugger"],
    );
});

const REJECTED: TestCase = {
    name: "reject",
    code: "debugger;",
    expect: [{ id: "no-debugger", line: 1, column: 1, text: "debugger;" }],
};
const ACCEPTED: TestCase = { name: "accept", code: "f();", expect: [] };

void test("individual rule registrations require both rejection and acceptance cases", () => {
    assert.throws(() => {
        requireRuleCases("no-debugger", [ACCEPTED]);
    }, /needs a rejection case/);
    assert.throws(() => {
        requireRuleCases("no-debugger", [REJECTED]);
    }, /needs an acceptance case/);
    assert.throws(() => {
        requireRuleCases("another-rule", [REJECTED, ACCEPTED]);
    }, /needs a rejection case/);
    assert.doesNotThrow(() => {
        requireRuleCases("no-debugger", [REJECTED, ACCEPTED]);
    });
});
