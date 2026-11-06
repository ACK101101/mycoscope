import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { runProcess } from "../../scripts/red-green/process.ts";

void test("the process runner returns actual output and status", async () => {
    const result = await runProcess(
        process.execPath,
        ["-e", 'console.log("ran"); process.exitCode = 1;'],
        resolve("."),
        {},
        5000,
    );
    assert.equal(result.code, 1);
    assert.equal(result.stdout.trim(), "ran");
});
void test("output overflow and signals are setup failures", async () => {
    await assert.rejects(
        runProcess(
            process.execPath,
            ["-e", 'process.stdout.write("x".repeat(10000));'],
            resolve("."),
            {},
            5000,
            100,
        ),
        /byte budget/,
    );
    await assert.rejects(
        runProcess(
            process.execPath,
            ["-e", 'process.kill(process.pid,"SIGKILL");'],
            resolve("."),
            {},
            5000,
        ),
        /outside assertions/,
    );
});
void test("a timeout terminates descendants rather than leaving CPU work behind", async () => {
    const directory = mkdtempSync(join(tmpdir(), "mycoscope-rg-process-"));
    try {
        const heartbeat = join(directory, "heartbeat");
        const worker =
            'const fs=require("node:fs");setInterval(()=>fs.appendFileSync(process.argv[1],"."),20);';
        const parent = `require("node:child_process").spawn(process.execPath,["-e",${JSON.stringify(worker)},${JSON.stringify(heartbeat)}],{stdio:"ignore"});setInterval(()=>{},1000);`;
        await assert.rejects(
            runProcess(process.execPath, ["-e", parent], directory, {}, 1000),
            /timed out/,
        );
        const before = readFileSync(heartbeat, "utf8");
        await setTimeout(150);
        assert.equal(readFileSync(heartbeat, "utf8"), before);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
void test("malformed CLI inputs return a structured rejection", () => {
    const result = spawnSync(
        process.execPath,
        [
            "--import",
            import.meta.resolve("tsx"),
            "scripts/check-red-green.ts",
            "--head",
            "main",
        ],
        { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.ok(result.stdout.includes('"status":"rejected"'));
});
