import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function run(failing: boolean, github = false): ReturnType<typeof spawnSync> {
    const directory = mkdtempSync(join(tmpdir(), "mycoscope-budget-smoke-"));
    try {
        mkdirSync(join(directory, "scripts/testing"), { recursive: true });
        for (const file of ["budgets.ts", "runtime-reporter.ts"])
            writeFileSync(
                join(directory, "scripts/testing", file),
                readFileSync(join("scripts/testing", file)),
            );
        writeFileSync(join(directory, "package.json"), '{"type":"module"}');
        writeFileSync(
            join(directory, "test-budgets.json"),
            '{"testMs":10,"suiteMs":10000}',
        );
        writeFileSync(
            join(directory, "case.test.mjs"),
            `import {test} from "node:test"; import assert from "node:assert/strict"; import {setTimeout} from "node:timers/promises"; test("slow case",async()=>{ await setTimeout(30); assert.equal(${String(failing)},false); });`,
        );
        return spawnSync(
            process.execPath,
            [
                "--import",
                import.meta.resolve("tsx"),
                "--test",
                "--test-reporter=spec",
                `--test-reporter=${join(directory, "scripts/testing/runtime-reporter.ts")}`,
                "--test-reporter-destination=stdout",
                "--test-reporter-destination=stderr",
                join(directory, "case.test.mjs"),
            ],
            {
                cwd: directory,
                encoding: "utf8",
                env: {
                    ...process.env,
                    NODE_TEST_CONTEXT: undefined,
                    GITHUB_ACTIONS: github ? "true" : "false",
                },
                timeout: 10000,
            },
        );
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}
void test("slow passing tests warn and still return success", () => {
    const result = run(false);
    assert.equal(result.status, 0, String(result.stderr));
    assert.ok(String(result.stderr).includes("[test-budget] Test slow case"));
});
void test("runtime warnings never conceal actual test failures", () => {
    const result = run(true);
    assert.equal(result.status, 1);
    assert.ok(String(result.stderr).includes("[test-budget] Test slow case"));
});
void test("CI receives a warning annotation rather than a failing gate", () => {
    const result = run(false, true);
    assert.equal(result.status, 0);
    assert.ok(String(result.stderr).includes("::warning::Test slow case"));
});
