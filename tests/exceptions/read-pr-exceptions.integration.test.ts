import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readExceptionReport } from "../../scripts/exceptions/read-pr-exceptions.ts";

void test("the report reads both Git snapshots from the merge base, independent of working-tree edits", () => {
    const directory = mkdtempSync(
        join(tmpdir(), "mycoscope-exception-report-"),
    );
    const git = (...args: readonly string[]): string =>
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
        const marker = "@effect-" + "diagnostics";
        const effectBoundary = `// ${marker} floatingEffect:error -- end Effect workaround`;
        const base =
            "/* eslint-disable no-debugger -- vendor workaround */\ndebugger;\n/* eslint-enable no-debugger -- end workaround */\ndebugger;\n" +
            `// ${marker} floatingEffect:off\n${effectBoundary}\nf();\n`;
        writeFileSync(join(directory, "sample.ts"), base);
        git("add", "sample.ts");
        git("commit", "-m", "base");
        git("checkout", "-b", "feature");
        writeFileSync(
            join(directory, "sample.ts"),
            base
                .replace(
                    "/* eslint-enable no-debugger -- end workaround */",
                    "// eslint-disable-next-line no-debugger -- second workaround",
                )
                .replace(effectBoundary, ""),
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

        const report = readExceptionReport("main", directory);
        assert.equal(report.commitId, git("rev-parse", "HEAD"));
        assert.deepEqual(report.changes, [
            {
                revision: "head",
                file: "sample.ts",
                line: 3,
                directive: "eslint-disable-next-line",
                reason: "second workaround",
            },
            {
                revision: "base",
                file: "sample.ts",
                line: 3,
                directive: "eslint-enable",
                reason: "end workaround",
            },
            {
                revision: "base",
                file: "sample.ts",
                line: 6,
                directive: `${marker} floatingEffect:error`,
                reason: "end Effect workaround",
            },
        ]);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
