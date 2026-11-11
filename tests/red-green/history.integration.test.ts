import { assertBehaviorEqual } from "../harness/behavior.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
    rmSync,
    chmodSync,
    readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { verify } from "../../scripts/red-green/verify.ts";

interface Fixture {
    readonly repository: string;
    readonly baseline: string;
    readonly tests: string;
    readonly head: string;
}
function git(repository: string, args: readonly string[]): string {
    return execFileSync(
        "git",
        [
            "-C",
            repository,
            "-c",
            "core.hooksPath=/dev/null",
            "-c",
            "commit.gpgsign=false",
            ...args,
        ],
        { encoding: "utf8" },
    ).trim();
}
function write(repository: string, file: string, text: string): void {
    const target = join(repository, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
}
function commit(repository: string, message: string): string {
    git(repository, ["add", "."]);
    git(repository, ["commit", "-qm", message]);
    return git(repository, ["rev-parse", "HEAD"]);
}
function fixture(): Fixture {
    const repository = mkdtempSync(join(tmpdir(), "mycoscope-rg-history-"));
    git(repository, ["init", "-q"]);
    git(repository, ["config", "user.name", "Contract fixture"]);
    git(repository, ["config", "user.email", "fixture@example.invalid"]);
    write(repository, ".gitignore", "node_modules/\n");
    for (const file of ["package.json", "package-lock.json"])
        write(repository, file, readFileSync(file, "utf8"));
    write(
        repository,
        "src/rule.mjs",
        "export const accepts = (value) => true;\n",
    );
    write(
        repository,
        "tests/harness/helper.ts",
        "export const sentinel = 1;\n",
    );
    write(
        repository,
        "tests/harness/behavior.ts",
        readFileSync("tests/harness/behavior.ts", "utf8"),
    );
    const baseline = commit(repository, "baseline behavior");
    write(
        repository,
        "tests/odd.test.ts",
        'import { assertBehaviorEqual as equal } from "./harness/behavior.ts"; import { test } from "node:test"; import { accepts } from "../src/rule.mjs";\ntest("reject odd", () => equal(accepts(1), false));\ntest("allow even", () => equal(accepts(2), true));\n',
    );
    write(
        repository,
        ".red-green/odd.json",
        JSON.stringify({
            version: 1,
            baseline,
            cases: [
                {
                    file: "tests/odd.test.ts",
                    name: "reject odd",
                    claim: "reject-odd",
                    baseline: {
                        status: "fail",
                        assertion: {
                            operator: "deepStrictEqual",
                            actual: true,
                            expected: false,
                        },
                    },
                },
                {
                    file: "tests/odd.test.ts",
                    name: "allow even",
                    claim: "reject-odd",
                    baseline: { status: "pass" },
                },
            ],
        }),
    );
    const tests = commit(repository, "tests only");
    write(
        repository,
        "src/rule.mjs",
        "export const accepts = (value) => value % 2 === 0;\n",
    );
    const head = commit(repository, "implement behavior");
    return { repository, baseline, tests, head };
}
function check(
    value: Fixture,
    head = value.head,
    base = value.baseline,
): ReturnType<typeof verify> {
    return verify({
        repository: value.repository,
        base,
        head,
        trunk: value.baseline,
        dependencyRoot: resolve("."),
    });
}
async function withFixture(
    run: (value: Fixture) => Promise<void>,
): Promise<void> {
    const value = fixture();
    try {
        await run(value);
    } finally {
        rmSync(value.repository, { recursive: true, force: true });
    }
}
void test("real tests-only and behavior commits yield reproducible RED/GREEN evidence", async () => {
    await withFixture(async (value) => {
        const report = await check(value);
        assertBehaviorEqual(report.status, "verified", JSON.stringify(report));
        assert.equal(report.contracts[0]?.testsCommit, value.tests);
        assert.equal(
            (await check(value, value.head, value.tests)).status,
            "verified",
        );
    });
});
void test("tests-only PR stays unready until behavior is implemented", async () => {
    await withFixture(async (value) => {
        assert.equal((await check(value, value.tests)).status, "rejected");
    });
});
void test("implementation cannot change frozen test cases or shared harness", async () => {
    for (const file of ["tests/odd.test.ts", "tests/harness/helper.ts"])
        await withFixture(async (value) => {
            write(value.repository, file, "export const erased = true;\n");
            const head = commit(value.repository, "weaken tests");
            assert.equal((await check(value, head)).status, "rejected");
        });
});
void test("a source edit committed before the tests commit is rejected even if reverted", async () => {
    await withFixture(async (value) => {
        git(value.repository, ["checkout", "-q", value.baseline]);
        write(
            value.repository,
            "src/rule.mjs",
            "export const accepts = () => false;\n",
        );
        commit(value.repository, "premature implementation");
        write(
            value.repository,
            "src/rule.mjs",
            "export const accepts = (value) => true;\n",
        );
        commit(value.repository, "revert premature implementation");
        git(value.repository, ["cherry-pick", value.tests]);
        const head = git(value.repository, ["rev-parse", "HEAD"]);
        assert.equal((await check(value, head)).status, "rejected");
    });
});
void test("source changes require a contract; unchanged characterization tests are preparation", async () => {
    await withFixture(async (value) => {
        git(value.repository, ["checkout", "-q", value.baseline]);
        write(
            value.repository,
            "src/rule.mjs",
            "export const accepts = () => false;\n",
        );
        assert.equal(
            (await check(value, commit(value.repository, "missing contract")))
                .status,
            "rejected",
        );
        git(value.repository, ["checkout", "-q", value.baseline]);
        write(
            value.repository,
            "tests/characterization.test.ts",
            'import {test} from "node:test"; test("existing behavior", () => {});',
        );
        assert.equal(
            (await check(value, commit(value.repository, "characterization")))
                .status,
            "preparation",
        );
    });
});
void test("new tests after the declared tests phase cannot be smuggled into implementation", async () => {
    await withFixture(async (value) => {
        write(
            value.repository,
            "tests/hidden.test.ts",
            'import {test} from "node:test"; test("hidden", () => {});',
        );
        assert.equal(
            (await check(value, commit(value.repository, "extra tests")))
                .status,
            "rejected",
        );
    });
});
void test("import failure cannot satisfy an expected assertion failure", async () => {
    await withFixture(async (value) => {
        git(value.repository, ["checkout", "-q", value.baseline]);
        const original = git(value.repository, [
            "show",
            `${value.tests}:tests/odd.test.ts`,
        ]);
        write(
            value.repository,
            "tests/odd.test.ts",
            original.replace("../src/rule.mjs", "../src/missing.mjs"),
        );
        write(
            value.repository,
            ".red-green/odd.json",
            git(value.repository, [
                "show",
                `${value.tests}:.red-green/odd.json`,
            ]),
        );
        const tests = commit(value.repository, "broken setup");
        assert.equal((await check(value, tests)).status, "rejected");
    });
});
void test("already-landed contracts do not freeze files forever", async () => {
    await withFixture(async (value) => {
        const report = await verify({
            repository: value.repository,
            base: value.head,
            head: value.head,
            trunk: value.head,
            dependencyRoot: resolve("."),
        });
        assert.equal(report.status, "preparation");
    });
});

async function lintReport(
    value: Fixture,
    invalid = "export const f = (a: number, b: number): boolean => a == b;",
): ReturnType<typeof verify> {
    git(value.repository, ["checkout", "-q", value.baseline]);
    for (const file of [
        "tsconfig.json",
        "tsconfig.effect-settings.json",
        "src/effects/directives.ts",
        "tests/harness/lint-adapter.ts",
        "tests/harness/rule-coverage.ts",
        "tests/harness/test-case.ts",
        "tests/harness/behavior.ts",
        "tests/snippets/case.ts",
        "tests/snippets/tsconfig.json",
    ])
        write(value.repository, file, readFileSync(file, "utf8"));
    const ruleFiles = readdirSync("eslint-rules", {
        recursive: true,
        encoding: "utf8",
    })
        .filter((file) => file.endsWith(".ts"))
        .map((file) => "eslint-rules/" + file);
    for (const file of ruleFiles)
        write(value.repository, file, readFileSync(file, "utf8"));
    const enabled = readFileSync("eslint.config.js", "utf8");
    write(
        value.repository,
        "eslint.config.js",
        enabled.replace('eqeqeq: ["error", "always"],', ""),
    );
    const baseline = commit(
        value.repository,
        "lint foundation without rule configuration",
    );
    write(
        value.repository,
        "tests/equality.test.ts",
        `import { testLintExamples } from "./harness/lint-adapter.ts";\ntestLintExamples("eqeqeq", ${JSON.stringify(invalid)}, "export const f = (a: number, b: number): boolean => a === b;");\n`,
    );
    write(
        value.repository,
        ".red-green/equality.json",
        JSON.stringify({
            version: 1,
            baseline,
            cases: [
                {
                    file: "tests/equality.test.ts",
                    name: "eqeqeq rejects its violation",
                    claim: "strict-equality",
                    baseline: {
                        status: "fail",
                        assertion: {
                            operator: "deepStrictEqual",
                            actual: false,
                            expected: true,
                        },
                    },
                },
                {
                    file: "tests/equality.test.ts",
                    name: "eqeqeq accepts its control",
                    claim: "strict-equality",
                    baseline: { status: "pass" },
                },
            ],
        }),
    );
    commit(value.repository, "equality tests first");
    write(value.repository, "eslint.config.js", enabled);
    const head = commit(value.repository, "enable equality rule");
    return verify({
        repository: value.repository,
        base: baseline,
        head,
        trunk: baseline,
        dependencyRoot: resolve("."),
    });
}
void test("a newly configured lint rule produces assertion RED rather than missing-config setup failure", async () => {
    await withFixture(async (value) => {
        const report = await lintReport(value);
        assertBehaviorEqual(report.status, "verified", JSON.stringify(report));
    });
});
void test("fatal parser diagnostics never become expected assertion RED", async () => {
    await withFixture(async (value) => {
        const report = await lintReport(value, "export const = ;");
        assert.equal(
            report.contracts[0]?.baselineValidated,
            false,
            JSON.stringify(report),
        );
    });
});

void test("Git export attributes cannot omit or rewrite the snapshot under test", async () => {
    await withFixture(async (value) => {
        git(value.repository, ["checkout", "-q", value.baseline]);
        write(
            value.repository,
            ".gitattributes",
            "tests export-ignore\nsrc/rule.mjs export-ignore\n",
        );
        const baseline = commit(
            value.repository,
            "export attributes are not runtime semantics",
        );
        write(
            value.repository,
            "tests/odd.test.ts",
            git(value.repository, ["show", `${value.tests}:tests/odd.test.ts`]),
        );
        const raw: unknown = JSON.parse(
            git(value.repository, [
                "show",
                `${value.tests}:.red-green/odd.json`,
            ]),
        );
        assert.ok(typeof raw === "object" && raw !== null);
        write(
            value.repository,
            ".red-green/odd.json",
            JSON.stringify({ ...raw, baseline }),
        );
        commit(value.repository, "frozen tests");
        write(
            value.repository,
            "src/rule.mjs",
            "export const accepts = (value) => value % 2 === 0;\n",
        );
        const report = await verify({
            repository: value.repository,
            base: baseline,
            head: commit(value.repository, "behavior"),
            trunk: baseline,
            dependencyRoot: resolve("."),
        });
        assertBehaviorEqual(report.status, "verified", JSON.stringify(report));
    });
});

void test("frozen file permissions are part of the test contract", async () => {
    await withFixture(async (value) => {
        chmodSync(join(value.repository, "tests/odd.test.ts"), 0o755);
        const head = commit(value.repository, "change frozen mode");
        assert.equal((await check(value, head)).status, "rejected");
    });
});

for (const invalid of [false, true])
    void test(
        invalid
            ? "invalid compiler configuration cannot qualify as behavioral RED"
            : "an absent compiler option is tested as behavior rather than setup failure",
        async () => {
            await withFixture(async (value) => {
                git(value.repository, ["checkout", "-q", value.baseline]);
                for (const file of [
                    "tests/harness/tsc-adapter.ts",
                    "tests/harness/test-case.ts",
                    "tests/harness/behavior.ts",
                ])
                    write(value.repository, file, readFileSync(file, "utf8"));
                write(
                    value.repository,
                    "tsconfig.json",
                    JSON.stringify({
                        compilerOptions: {
                            target: "ESNext",
                            lib: ["ESNext"],
                            ...(invalid ? { noImplicitAny: "yes" } : {}),
                        },
                    }),
                );
                const baseline = commit(
                    value.repository,
                    "compiler foundation",
                );
                write(
                    value.repository,
                    "tests/implicit.test.ts",
                    'import { testCompilerOption } from "./harness/tsc-adapter.ts";\ntestCompilerOption("noImplicitAny", [{ name: "implicit parameter", code: "export function f(value) { return value; }", expect: [{ id: "TS7006", line: 1, column: 19, text: "value" }] }, { name: "typed parameter", code: "export function f(value: number) { return value; }", expect: [] }]);\n',
                );
                write(
                    value.repository,
                    ".red-green/implicit.json",
                    JSON.stringify({
                        version: 1,
                        baseline,
                        cases: [
                            {
                                file: "tests/implicit.test.ts",
                                name: "implicit parameter",
                                claim: "explicit-parameter-types",
                                baseline: {
                                    status: "fail",
                                    assertion: {
                                        operator: "deepStrictEqual",
                                        actual: [],
                                        expected: [
                                            {
                                                id: "TS7006",
                                                line: 1,
                                                column: 19,
                                                text: "value",
                                            },
                                        ],
                                    },
                                },
                            },
                            {
                                file: "tests/implicit.test.ts",
                                name: "typed parameter",
                                claim: "explicit-parameter-types",
                                baseline: { status: "pass" },
                            },
                        ],
                    }),
                );
                commit(value.repository, "implicit parameter tests");
                write(
                    value.repository,
                    "tsconfig.json",
                    JSON.stringify({
                        compilerOptions: {
                            target: "ESNext",
                            lib: ["ESNext"],
                            noImplicitAny: true,
                        },
                    }),
                );
                const report = await verify({
                    repository: value.repository,
                    base: baseline,
                    head: commit(value.repository, "enable compiler option"),
                    trunk: baseline,
                    dependencyRoot: resolve("."),
                });
                assertBehaviorEqual(
                    report.status,
                    invalid ? "rejected" : "verified",
                    JSON.stringify(report),
                );
            });
        },
    );

void test("moving the baseline past the PR base cannot hide earlier unproven source edits", async () => {
    await withFixture(async (value) => {
        git(value.repository, ["checkout", "-q", value.baseline]);
        write(
            value.repository,
            "src/rule.mjs",
            "export const accepts = (value) => value % 2 === 0;\n",
        );
        const movedBaseline = commit(
            value.repository,
            "source before any tests",
        );
        write(
            value.repository,
            "tests/limit.test.ts",
            'import {assertBehaviorEqual as equal} from "./harness/behavior.ts"; import {test} from "node:test"; import {accepts} from "../src/rule.mjs"; test("limit",()=>equal(accepts(12),false));',
        );
        write(
            value.repository,
            ".red-green/limit.json",
            JSON.stringify({
                version: 1,
                baseline: movedBaseline,
                cases: [
                    {
                        file: "tests/limit.test.ts",
                        name: "limit",
                        claim: "limit",
                        baseline: {
                            status: "fail",
                            assertion: {
                                operator: "deepStrictEqual",
                                actual: true,
                                expected: false,
                            },
                        },
                    },
                ],
            }),
        );
        commit(value.repository, "tests after earlier behavior");
        write(
            value.repository,
            "src/rule.mjs",
            "export const accepts = (value) => value % 2 === 0 && value < 10;\n",
        );
        assert.equal(
            (await check(value, commit(value.repository, "more behavior")))
                .status,
            "rejected",
        );
    });
});

void test("candidate execution cannot silently omit previously executed tests", async () => {
    await withFixture(async (value) => {
        git(value.repository, ["checkout", "-q", value.baseline]);
        write(
            value.repository,
            "tests/old.test.ts",
            'import {test} from "node:test"; import {accepts} from "../src/rule.mjs"; if (accepts(1)) { test("legacy case",()=>{}); } else { process.exit(0); }',
        );
        const baseline = commit(
            value.repository,
            "existing test before new feature",
        );
        write(
            value.repository,
            "tests/odd.test.ts",
            git(value.repository, ["show", `${value.tests}:tests/odd.test.ts`]),
        );
        const raw: unknown = JSON.parse(
            git(value.repository, [
                "show",
                `${value.tests}:.red-green/odd.json`,
            ]),
        );
        assert.ok(typeof raw === "object" && raw !== null);
        write(
            value.repository,
            ".red-green/odd.json",
            JSON.stringify({ ...raw, baseline }),
        );
        commit(value.repository, "new rejection test");
        write(
            value.repository,
            "src/rule.mjs",
            "export const accepts = (value) => value % 2 === 0;\n",
        );
        const report = await verify({
            repository: value.repository,
            base: baseline,
            head: commit(value.repository, "behavior changes registration"),
            trunk: baseline,
            dependencyRoot: resolve("."),
        });
        assert.equal(report.status, "rejected", JSON.stringify(report));
    });
});
