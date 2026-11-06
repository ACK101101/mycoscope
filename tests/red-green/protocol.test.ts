import { behavior } from "../../scripts/red-green/git.ts";
import { failure } from "../../scripts/red-green/reporter.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
    parseManifest,
    parseTranscript,
} from "../../scripts/red-green/model.ts";
import { checkEvidence } from "../../scripts/red-green/evidence.ts";

const manifestValue = {
    version: 1,
    baseline: "a".repeat(40),
    cases: [
        {
            file: "tests/rule.test.ts",
            name: "reject",
            claim: "reject-loose-equality",
            baseline: {
                status: "fail",
                assertion: {
                    operator: "deepStrictEqual",
                    actual: [],
                    expected: ["eqeqeq"],
                },
            },
        },
        {
            file: "tests/rule.test.ts",
            name: "control",
            claim: "reject-loose-equality",
            baseline: { status: "pass" },
        },
    ],
};
const assertion = {
    kind: "assertion",
    operator: "deepStrictEqual",
    actual: [],
    expected: ["eqeqeq"],
};
function transcript(results: readonly unknown[], failed: number): string {
    return [
        ...results,
        {
            type: "summary",
            success: failed === 0,
            tests: results.length,
            failed,
            passed: results.length - failed,
            skipped: 0,
            todo: 0,
            cancelled: 0,
        },
    ]
        .map((value) => JSON.stringify(value))
        .join("\n");
}
function outcomes(
    results: readonly unknown[],
    failed: number,
): ReturnType<typeof parseTranscript> {
    return parseTranscript(transcript(results, failed));
}
const red = [
    {
        type: "result",
        file: "tests/rule.test.ts",
        name: "reject",
        status: "fail",
        error: assertion,
    },
    {
        type: "result",
        file: "tests/rule.test.ts",
        name: "control",
        status: "pass",
    },
];
const green = red.map((value) => ({
    type: "result",
    file: value.file,
    name: value.name,
    status: "pass",
}));

void test("declared assertion failure and passing control constitute RED evidence", () => {
    assert.deepEqual(
        checkEvidence(
            parseManifest(manifestValue),
            outcomes(red, 1),
            "baseline",
            1,
        ),
        [],
    );
});
void test("same frozen cases must all pass on the candidate", () => {
    const manifest = parseManifest(manifestValue);
    assert.deepEqual(
        checkEvidence(manifest, outcomes(green, 0), "candidate", 0),
        [],
    );
    assert.ok(
        checkEvidence(manifest, outcomes(red, 1), "candidate", 1).length > 0,
    );
});
void test("a baseline that already passes does not distinguish the change", () => {
    assert.ok(
        checkEvidence(
            parseManifest(manifestValue),
            outcomes(green, 0),
            "baseline",
            0,
        ).length > 0,
    );
});
void test("setup errors and wrong assertions cannot count as expected RED", () => {
    for (const error of [
        { kind: "setup", message: "ERR_MODULE_NOT_FOUND" },
        { ...assertion, actual: ["parser failure"] },
    ]) {
        const results = [{ ...red[0], error }, red[1]];
        assert.ok(
            checkEvidence(
                parseManifest(manifestValue),
                outcomes(results, 1),
                "baseline",
                1,
            ).length > 0,
        );
    }
});
void test("missing, unexpected, duplicated or skipped cases invalidate evidence", () => {
    const manifest = parseManifest(manifestValue);
    for (const results of [
        red.slice(0, 1),
        [...red, red[0]],
        [
            ...red,
            {
                type: "result",
                file: "tests/rule.test.ts",
                name: "hidden",
                status: "pass",
            },
        ],
        [red[0], { ...red[1], status: "skip" }],
    ]) {
        assert.ok(
            checkEvidence(manifest, outcomes(results, 1), "baseline", 1)
                .length > 0,
        );
    }
});
void test("unlisted existing tests must pass in both phases", () => {
    const extra = {
        type: "result",
        file: "tests/old.test.ts",
        name: "old",
        status: "fail",
        error: assertion,
    };
    assert.ok(
        checkEvidence(
            parseManifest(manifestValue),
            outcomes([...red, extra], 2),
            "baseline",
            1,
        ).length > 0,
    );
});
void test("every claim needs a distinguishing case and every case has a unique identity", () => {
    assert.throws(() =>
        parseManifest({ ...manifestValue, cases: [manifestValue.cases[1]] }),
    );
    assert.throws(() =>
        parseManifest({
            ...manifestValue,
            cases: [...manifestValue.cases, manifestValue.cases[0]],
        }),
    );
    assert.throws(() =>
        parseManifest({
            ...manifestValue,
            cases: [{ ...manifestValue.cases[0], file: "../outside.test.ts" }],
        }),
    );
    assert.throws(() => parseManifest({ ...manifestValue, baseline: "main" }));
});
void test("exit status, global summary and result counts must agree", () => {
    const manifest = parseManifest(manifestValue);
    assert.ok(
        checkEvidence(manifest, outcomes(red, 1), "baseline", 0).length > 0,
    );
    assert.throws(() => parseTranscript(JSON.stringify(red[0])));
    assert.throws(() => parseTranscript("not json"));
    const wrong = transcript(red, 1).replace('"tests":2', '"tests":9');
    assert.ok(
        checkEvidence(manifest, parseTranscript(wrong), "baseline", 1).length >
            0,
    );
});

void test("array-valued event statuses cannot masquerade as protocol strings", () => {
    const invalid = [
        {
            type: "result",
            file: "tests/rule.test.ts",
            name: "control",
            status: ["pass"],
        },
    ];
    assert.throws(() => parseTranscript(transcript(invalid, 0)));
});

void test("ordinary setup assertions are not accepted as deliberate behavioral RED", () => {
    const error = new assert.AssertionError({
        operator: "deepStrictEqual",
        actual: [],
        expected: ["rule"],
    });
    assert.equal(
        failure({ failureType: "testCodeFailure", cause: error }).kind,
        "setup",
    );
});

void test("policy and unknown configuration changes require a contract", () => {
    for (const file of [
        "mycoscope.effects.json",
        ".npmrc",
        "future-policy.toml",
        "src/new-module.ts",
    ])
        assert.equal(behavior(file), true, file);
    for (const file of [
        "docs/testing.md",
        "README.md",
        "tests/harness/behavior.ts",
        "tests/rules/case.test.ts",
        ".red-green/case.json",
    ])
        assert.equal(behavior(file), false, file);
});
