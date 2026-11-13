import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const TSX_LOADER = import.meta.resolve("tsx");
const COMPILER_ADAPTER = import.meta.resolve("./tsc-adapter.ts");
const LINT_ADAPTER = import.meta.resolve("./lint-adapter.ts");
// Child processes need normal test output rather than the parent runner's binary protocol.
const CHILD_ENV = Object.fromEntries(
    Object.entries(process.env).filter(
        ([name]) => name !== "NODE_TEST_CONTEXT",
    ),
);

// Isolate prototype mocks and working-directory changes from the other tests.
void test("a missing ESLint result fails instead of passing an acceptance case", () => {
    const result = spawnSync(
        process.execPath,
        [
            "--import",
            TSX_LOADER,
            "--input-type=module",
            "--eval",
            `
                import { mock } from "node:test";
                import { ESLint } from "eslint";
                import { lintRule } from ${JSON.stringify(LINT_ADAPTER)};
                mock.method(ESLint.prototype, "lintText", async () => []);
                await lintRule("eqeqeq", "export const n = 1;");
            `,
        ],
        { env: CHILD_ENV, encoding: "utf8", timeout: 20_000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /ESLint returned no result/);
});

const CONFIG_FAILURES = [
    { name: "missing", config: undefined, phase: "read" },
    {
        name: "malformed",
        config: '{"compilerOptions":{"noImplicitAny":true}',
        phase: "read",
    },
    {
        name: "unknown compiler option",
        config: JSON.stringify({
            compilerOptions: { noImplicitAny: true, notACompilerOption: true },
        }),
        phase: "parse",
    },
];

for (const { name, config, phase } of CONFIG_FAILURES) {
    void test(`tsconfig setup fails for ${name} configuration`, () => {
        const directory = mkdtempSync(join(tmpdir(), "mycoscope-harness-"));
        try {
            writeFileSync(join(directory, "input.ts"), "export {};\n");
            if (config !== undefined) {
                writeFileSync(join(directory, "tsconfig.json"), config);
            }
            const result = spawnSync(
                process.execPath,
                [
                    "--import",
                    TSX_LOADER,
                    "--input-type=module",
                    "--eval",
                    `
                        import { compileWithOption } from ${JSON.stringify(COMPILER_ADAPTER)};
                        compileWithOption("noImplicitAny", "export {};");
                    `,
                ],
                {
                    cwd: directory,
                    env: CHILD_ENV,
                    encoding: "utf8",
                    timeout: 20_000,
                },
            );
            assert.ifError(result.error);
            assert.equal(result.status, 1, result.stdout + result.stderr);
            assert.match(
                result.stderr,
                new RegExp(`Failed to ${phase} tsconfig\\.json: TS\\d+`),
            );
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });
}

void test("a different syntax restriction cannot satisfy a selector's rejection case", () => {
    const result = spawnSync(
        process.execPath,
        [
            "--import",
            TSX_LOADER,
            "--input-type=module",
            "--eval",
            `
                import assert from "node:assert/strict";
                import { lintSyntaxRestriction } from ${JSON.stringify(LINT_ADAPTER)};
                const diagnostics = await lintSyntaxRestriction("ImportExpression", "Reflect.ownKeys({});");
                assert.deepEqual(diagnostics.map(({id}) => id), ["no-restricted-syntax"]);
            `,
        ],
        { env: CHILD_ENV, encoding: "utf8", timeout: 20_000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(
        result.stdout + result.stderr,
        /Expected values to be strictly deep-equal/,
    );
});

void test("skipped tests and unused callbacks do not establish rule coverage", () => {
    const result = spawnSync(
        process.execPath,
        [
            "--import",
            TSX_LOADER,
            "--input-type=module",
            "--test-reporter=tap",
            "--eval",
            `
                import assert from "node:assert/strict";
                import { after, test } from "node:test";
                import { lintRule, lintCoverage } from ${JSON.stringify(LINT_ADAPTER)};
                const unused = () => lintRule("eqeqeq", "1 == 1;");
                test.skip("skipped rejection", unused);
                test.skip("skipped acceptance", () => lintRule("eqeqeq", "1 === 1;"));
                after(() => assert.deepEqual(lintCoverage(), []));
            `,
        ],
        { env: CHILD_ENV, encoding: "utf8", timeout: 20_000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /# skipped 2/);
});

void test("missing rule coverage exits unsuccessfully in the shared test process", () => {
    const result = spawnSync(
        process.execPath,
        [
            "--import",
            TSX_LOADER,
            "--test",
            "--test-isolation=none",
            "tests/eslint/rule-coverage.test.ts",
        ],
        { env: CHILD_ENV, encoding: "utf8", timeout: 20_000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(
        result.stdout + result.stderr,
        /Configured syntax selectors need rejection and acceptance coverage/,
    );
});
