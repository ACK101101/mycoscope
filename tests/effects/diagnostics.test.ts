import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const IMPORT = 'import { Effect, Context, Layer } from "effect";\n';
const CASES = [
    {
        name: "floatingEffect",
        bad: "Effect.succeed(1);",
        good: "export const value = Effect.succeed(1);",
        message: "neither yielded nor used",
    },
    {
        name: "missingEffectError",
        bad: 'export const f = (): Effect.Effect<never> => Effect.fail("oops");',
        good: 'export const f = (): Effect.Effect<never, string, never> => Effect.fail("oops");',
        message: "expected Effect errors",
    },
    {
        name: "missingEffectContext",
        bad: 'class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}\nexport const f: Effect.Effect<number> = Effect.gen(function* () { yield* Reader; return 1; });',
        good: 'class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}\nexport const f: Effect.Effect<number, never, Reader> = Effect.gen(function* () { yield* Reader; return 1; });',
        message: "missing from the expected Effect context",
    },
    {
        name: "missingLayerContext",
        bad: 'class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}\nclass Config extends Context.Service<Config, { path: string }>()("Config") {}\nexport const layer: Layer.Layer<Reader> = Layer.effect(Reader, Effect.gen(function* () { yield* Config; return { read: () => "x" }; }));',
        good: 'class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}\nclass Config extends Context.Service<Config, { path: string }>()("Config") {}\nexport const layer: Layer.Layer<Reader, never, Config> = Layer.effect(Reader, Effect.gen(function* () { yield* Config; return { read: () => "x" }; }));',
        message: "expected Layer context",
    },
    {
        name: "anyUnknownInErrorContext",
        bad: "export const value = Effect.fail(undefined as unknown);",
        good: 'export const value = Effect.fail("known");',
        message: "unknown in the error channel",
    },
];

async function check(
    code: string,
): Promise<{ readonly status: number | null; readonly output: string }> {
    const directory = await mkdtemp(
        join(tmpdir(), "mycoscope-effect-diagnostics-"),
    );
    try {
        const settings: unknown = JSON.parse(
            await readFile("tsconfig.effect-settings.json", "utf8"),
        );
        assert.ok(
            typeof settings === "object" &&
                settings !== null &&
                "compilerOptions" in settings &&
                typeof settings.compilerOptions === "object" &&
                settings.compilerOptions !== null,
        );
        await symlink(
            resolve("node_modules"),
            join(directory, "node_modules"),
            "dir",
        );
        await writeFile(join(directory, "package.json"), '{"type":"module"}');
        await writeFile(
            join(directory, "tsconfig.json"),
            JSON.stringify({
                compilerOptions: {
                    target: "ESNext",
                    module: "NodeNext",
                    noEmit: true,
                    strict: true,
                    skipLibCheck: true,
                    ...settings.compilerOptions,
                },
                include: ["case.ts"],
            }),
        );
        await writeFile(join(directory, "case.ts"), IMPORT + code);
        const result = spawnSync(
            process.execPath,
            [
                resolve("node_modules/@effect/language-service/cli.js"),
                "diagnostics",
                "--project",
                join(directory, "tsconfig.json"),
                "--format",
                "json",
                "--strict",
            ],
            { encoding: "utf8", timeout: 30000 },
        );
        assert.equal(result.error, undefined);
        return { status: result.status, output: result.stdout + result.stderr };
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

for (const example of CASES) {
    void test(`Effect ${example.name} fails CI on its violation and accepts its control`, async () => {
        const bad = await check(example.bad);
        assert.equal(bad.status, 1, bad.output);
        assert.ok(bad.output.includes(example.message), bad.output);
        const good = await check(example.good);
        assert.equal(good.status, 0, good.output);
    });
}

void test("every enabled upstream Effect diagnostic has a behavior case", async () => {
    const text = await readFile("tsconfig.effect-settings.json", "utf8");
    const configured: unknown = JSON.parse(text);
    assert.ok(
        typeof configured === "object" &&
            configured !== null &&
            "compilerOptions" in configured,
    );
    const options = configured.compilerOptions;
    assert.ok(
        typeof options === "object" &&
            options !== null &&
            "plugins" in options &&
            Array.isArray(options.plugins),
    );
    const plugin: unknown = options.plugins[0];
    assert.ok(
        typeof plugin === "object" &&
            plugin !== null &&
            "diagnosticSeverity" in plugin,
    );
    const severities = plugin.diagnosticSeverity;
    assert.ok(typeof severities === "object" && severities !== null);
    assert.deepEqual(
        Object.entries(severities)
            .filter(([, severity]) => severity !== "off")
            .map(([name]) => name)
            .toSorted(),
        CASES.map((example) => example.name).toSorted(),
    );
});

void test("reasoned upstream suppressions retain their native behavior", async () => {
    const result = await check(
        "// @effect-diagnostics-next-line effect/floatingEffect:off -- callback owns execution\nEffect.succeed(1);",
    );
    assert.equal(result.status, 0, result.output);
});
