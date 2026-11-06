import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

void test("wiring CLI emits its graph, fails violations and rejects malformed policy", () => {
    const directory = mkdtempSync(join(tmpdir(), "mycoscope-cli-"));
    try {
        symlinkSync(
            resolve("node_modules"),
            join(directory, "node_modules"),
            "dir",
        );
        writeFileSync(join(directory, "package.json"), '{"type":"module"}');
        writeFileSync(
            join(directory, "tsconfig.json"),
            JSON.stringify({
                compilerOptions: {
                    strict: true,
                    types: ["node"],
                    module: "NodeNext",
                    skipLibCheck: true,
                },
                include: ["main.ts"],
            }),
        );
        const config = join(directory, "mycoscope.effects.json");
        writeFileSync(
            config,
            JSON.stringify({
                project: "tsconfig.json",
                wiringRoots: [],
                adapters: [],
            }),
        );
        const run = (): ReturnType<typeof spawnSync> =>
            spawnSync(
                process.execPath,
                [
                    "--import",
                    import.meta.resolve("tsx"),
                    resolve("src/index.ts"),
                    config,
                ],
                { encoding: "utf8", timeout: 30000, cwd: tmpdir() },
            );
        writeFileSync(
            join(directory, "main.ts"),
            'import { Effect } from "effect"; export const task = Effect.succeed(1);',
        );
        const bad = run();
        assert.equal(bad.status, 1, String(bad.stderr));
        assert.ok(String(bad.stdout).includes('"effect-contract"'));
        writeFileSync(
            join(directory, "main.ts"),
            'import { Effect } from "effect"; export const task: Effect.Effect<number, never, never> = Effect.succeed(1);',
        );
        const good = run();
        assert.equal(good.status, 0, String(good.stdout) + String(good.stderr));
        assert.ok(String(good.stdout).includes('"contracts"'));
        writeFileSync(
            join(directory, "main.ts"),
            'export const n: number = "type error";',
        );
        assert.equal(run().status, 1);
        writeFileSync(config, '{"adapters":"all"}');
        assert.equal(run().status, 1);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
