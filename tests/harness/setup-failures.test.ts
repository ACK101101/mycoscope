import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const TSX_LOADER = import.meta.resolve("tsx");
const COMPILER_ADAPTER = new URL("./tsc-adapter.ts", import.meta.url).href;
const LINT_ADAPTER = new URL("./lint-adapter.ts", import.meta.url).href;
// Child processes need normal test output rather than the parent runner's binary protocol.
const CHILD_ENV = { ...process.env };
delete CHILD_ENV["NODE_TEST_CONTEXT"];

// Run each setup failure in a child process so its test registrations and working
// directory cannot affect the other harness tests.
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
                import { testLintRule } from ${JSON.stringify(LINT_ADAPTER)};
                mock.method(ESLint.prototype, "lintText", async () => []);
                testLintRule("eqeqeq", [{
                    name: "valid source",
                    code: "export const n = 1;",
                    expect: [],
                }]);
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
                        import { testCompilerOption } from ${JSON.stringify(COMPILER_ADAPTER)};
                        testCompilerOption("noImplicitAny", []);
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
