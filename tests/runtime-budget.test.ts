import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetWarnings, parseBudgets } from "../scripts/testing/budgets.ts";
import { selectTests } from "../scripts/testing/selection.ts";

const budgets = { testMs: 100, suiteMs: 10000 };
void test("each slow test produces a warning without changing test outcome", () => {
    assert.deepEqual(
        budgetWarnings(
            { kind: "test", name: "rule case", durationMs: 101 },
            budgets,
        ),
        ["Test rule case took 101 ms (budget 100 ms)."],
    );
    assert.deepEqual(
        budgetWarnings(
            { kind: "test", name: "fast", durationMs: 100 },
            budgets,
        ),
        [],
    );
});
void test("suite budget also catches setup time outside individual tests", () => {
    assert.deepEqual(
        budgetWarnings(
            { kind: "suite", name: "local", durationMs: 11000 },
            budgets,
        ),
        ["Suite local took 11000 ms (budget 10000 ms)."],
    );
});
void test("runtime budgets must be finite positive numbers", () => {
    assert.deepEqual(parseBudgets(budgets), budgets);
    for (const bad of [
        { testMs: 0, suiteMs: 1 },
        { testMs: Infinity, suiteMs: 1 },
        { testMs: "100", suiteMs: 1 },
    ])
        assert.throws(() => parseBudgets(bad));
});
void test("integration selection is exhaustive and disjoint from the fast default", () => {
    const files = [
        "tests/rule.test.ts",
        "tests/cli.integration.test.ts",
        "tests/harness/project.test.ts",
    ];
    const unit = selectTests(files, "unit");
    const integration = selectTests(files, "integration");
    assert.deepEqual(unit, [
        "tests/harness/project.test.ts",
        "tests/rule.test.ts",
    ]);
    assert.deepEqual(integration, ["tests/cli.integration.test.ts"]);
    assert.deepEqual(
        [...unit, ...integration].toSorted(),
        selectTests(files, "all"),
    );
    assert.deepEqual(
        selectTests([...files, "tests/fixtures/bad.test.ts"], "all"),
        selectTests(files, "all"),
    );
});
