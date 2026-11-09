import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPORT = fileURLToPath(
    import.meta.resolve("../scripts/exceptions-report.ts"),
);
const LOADER = import.meta.resolve("tsx");
const CHILD_ENV = Object.fromEntries(
    Object.entries(process.env).filter(
        ([name]) => name !== "NODE_TEST_CONTEXT",
    ),
);

void test("the report reads both Git snapshots from the merge base, independent of working-tree edits", () => {
    const directory = mkdtempSync(
        join(tmpdir(), "mycoscope-exception-report-"),
    );
    const git = (...args: string[]): string =>
        execFileSync(
            "git",
            [
                "-c",
                "user.name=Harness",
                "-c",
                "user.email=harness@example.invalid",
                "-c",
                "commit.gpgsign=false",
                "-c",
                "core.hooksPath=/dev/null",
                ...args,
            ],
            {
                cwd: directory,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            },
        ).trim();
    try {
        git("init", "--initial-branch=main");
        const base =
            "/* eslint-disable no-debugger -- vendor workaround */\ndebugger;\n/* eslint-enable no-debugger -- end workaround */\ndebugger;\n";
        writeFileSync(join(directory, "sample.ts"), base);
        git("add", "sample.ts");
        git("commit", "-m", "base");
        git("checkout", "-b", "feature");
        writeFileSync(
            join(directory, "sample.ts"),
            base.replace(
                "/* eslint-enable no-debugger -- end workaround */",
                "// eslint-disable-next-line no-debugger -- second workaround",
            ),
        );
        git("commit", "-am", "change suppression boundary");
        git("checkout", "main");
        writeFileSync(
            join(directory, "sample.ts"),
            "// upstream context\n" + base,
        );
        git("commit", "-am", "upstream change");
        git("checkout", "feature");
        writeFileSync(join(directory, "sample.ts"), "debugger;\n");

        const result = spawnSync(
            process.execPath,
            ["--import", LOADER, REPORT, "main"],
            {
                cwd: directory,
                encoding: "utf8",
                env: CHILD_ENV,
                timeout: 20_000,
            },
        );
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(
            result.stdout,
            /Added or edited directive \(head\).*sample\.ts:3.*second workaround/,
        );
        assert.match(
            result.stdout,
            /Removed or edited suppression boundary \(base\).*sample\.ts:3.*end workaround/,
        );
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
