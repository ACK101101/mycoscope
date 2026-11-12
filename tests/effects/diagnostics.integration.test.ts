import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { EFFECT_DIAGNOSTIC_CASES } from "./diagnostic-cases.ts";

const SETTINGS_PATH = new URL(
    "../../tsconfig.effect-settings.json",
    import.meta.url,
);
const NODE_MODULES_PATH = fileURLToPath(
    new URL("../../node_modules", import.meta.url),
);
const EFFECT_CLI_PATH = fileURLToPath(
    import.meta.resolve("@effect/language-service/cli.js"),
);
const CHILD_ENV = Object.fromEntries(
    Object.entries(process.env).filter(
        ([name]) => name !== "NODE_TEST_CONTEXT",
    ),
);
const IMPORT = 'import { Effect, Context, Layer } from "effect";\n';

async function runEffectDiagnostics(code: string): Promise<{
    readonly status: number | null;
    readonly diagnostics: readonly {
        readonly name: string;
        readonly severity: string;
        readonly message: string;
    }[];
}> {
    const directory = await mkdtemp(
        join(tmpdir(), "mycoscope-effect-diagnostics-"),
    );
    try {
        const settings: unknown = JSON.parse(
            await readFile(SETTINGS_PATH, "utf8"),
        );
        assert.ok(
            typeof settings === "object" &&
                settings !== null &&
                "compilerOptions" in settings &&
                typeof settings.compilerOptions === "object" &&
                settings.compilerOptions !== null,
        );
        await symlink(
            NODE_MODULES_PATH,
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
                EFFECT_CLI_PATH,
                "diagnostics",
                "--project",
                "tsconfig.json",
                "--format",
                "json",
                "--strict",
            ],
            {
                cwd: directory,
                env: CHILD_ENV,
                encoding: "utf8",
                timeout: 30_000,
            },
        );
        assert.ifError(result.error);
        const output: unknown = JSON.parse(result.stdout);
        assert.ok(
            typeof output === "object" &&
                output !== null &&
                "diagnostics" in output &&
                Array.isArray(output.diagnostics),
            result.stdout + result.stderr,
        );
        const diagnostics = output.diagnostics.map((diagnostic: unknown) => {
            assert.ok(
                typeof diagnostic === "object" &&
                    diagnostic !== null &&
                    "name" in diagnostic &&
                    typeof diagnostic.name === "string" &&
                    "severity" in diagnostic &&
                    typeof diagnostic.severity === "string" &&
                    "message" in diagnostic &&
                    typeof diagnostic.message === "string",
            );
            return {
                name: diagnostic.name,
                severity: diagnostic.severity,
                message: diagnostic.message,
            };
        });
        return { status: result.status, diagnostics };
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

for (const example of EFFECT_DIAGNOSTIC_CASES) {
    void test(`Effect ${example.name} rejects its violation`, async () => {
        const result = await runEffectDiagnostics(example.rejected);
        assert.equal(result.status, 1);
        assert.deepEqual(
            result.diagnostics.map(({ name, severity }) => ({
                name,
                severity,
            })),
            example.diagnosticNames.map((name) => ({
                name,
                severity: "error",
            })),
        );
        for (const diagnostic of result.diagnostics) {
            assert.ok(
                diagnostic.message.includes(example.message),
                diagnostic.message,
            );
        }
    });
    void test(`Effect ${example.name} accepts its control`, async () => {
        const result = await runEffectDiagnostics(example.accepted);
        assert.equal(result.status, 0);
        assert.deepEqual(result.diagnostics, []);
    });
}

void test("reasoned upstream suppressions retain their native behavior", async () => {
    const result = await runEffectDiagnostics(
        "// @effect-" +
            "diagnostics-next-line effect/floatingEffect:off -- callback owns execution\nEffect.succeed(1);",
    );
    assert.equal(result.status, 0);
    assert.deepEqual(result.diagnostics, []);
});
