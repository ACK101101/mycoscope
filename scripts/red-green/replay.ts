import { runProcess } from "./process.ts";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { install, snapshot } from "./git.ts";
import { parseTranscript, type Transcript } from "./model.ts";

export interface Execution {
    readonly transcript: Transcript;
    readonly exitCode: number;
}
// No caller-controlled preloads, GitHub command files, credentials or caches enter the test process.
function environment(home: string): NodeJS.ProcessEnv {
    return {
        PATH: process.env["PATH"],
        HOME: home,
        TMPDIR: home,
        TMP: home,
        TEMP: home,
        LANG: "en_US.UTF-8",
        CI: "true",
        NODE_OPTIONS: "--max-old-space-size=768",
        NODE_DISABLE_COLORS: "1",
    };
}
export async function replay(
    repository: string,
    production: string,
    testsCommit: string,
    testFiles: readonly string[],
    workspace: string,
    dependencyRoot: string,
): Promise<Execution> {
    if (process.platform === "win32")
        throw new Error(
            "The contract runner currently requires POSIX process groups.",
        );
    const directory = join(workspace, "project");
    const frozen = join(workspace, "frozen");
    const home = join(workspace, "home");
    mkdirSync(home, { recursive: true });
    const env = environment(home);
    snapshot(repository, production, directory);
    snapshot(repository, testsCommit, frozen);
    rmSync(join(directory, "tests"), { recursive: true, force: true });
    cpSync(join(frozen, "tests"), join(directory, "tests"), {
        recursive: true,
    });
    // Archive attributes cannot silently rewrite or omit the tests being frozen.
    for (const file of testFiles) {
        const expected = readFileSync(join(frozen, file));
        if (!expected.equals(readFileSync(join(directory, file))))
            throw new Error(`Frozen test copy differs: ${file}`);
    }
    install(directory, dependencyRoot, env);
    const reporter = fileURLToPath(new URL("./reporter.ts", import.meta.url));
    const loader = import.meta.resolve("tsx");
    const result = await runProcess(
        process.execPath,
        [
            "--import",
            loader,
            "--test",
            "--test-concurrency=1",
            "--test-timeout=30000",
            `--test-reporter=${reporter}`,
            ...testFiles.map((file) => resolve(directory, file)),
        ],
        directory,
        env,
    );
    if (result.code !== 0 && result.code !== 1)
        throw new Error(
            `Unexpected test process exit ${String(result.code)}: ${result.stderr}`,
        );
    return {
        transcript: parseTranscript(result.stdout),
        exitCode: result.code,
    };
}
