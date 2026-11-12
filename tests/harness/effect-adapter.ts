import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

export async function runEffectDiagnostics(code: string): Promise<{
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
        await writeFile(join(directory, "case.ts"), code);
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

export async function readEffectDiagnosticSeverities(): Promise<object> {
    const text = await readFile(
        new URL("../../tsconfig.effect-settings.json", import.meta.url),
        "utf8",
    );
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
    return severities;
}
