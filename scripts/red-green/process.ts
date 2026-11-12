import { spawn } from "node:child_process";

export interface ProcessOutput {
    readonly stdout: string;
    readonly stderr: string;
    readonly code: number;
}
export function runProcess(
    command: string,
    args: readonly string[],
    cwd: string,
    env: Readonly<NodeJS.ProcessEnv>,
    timeoutMs = 180000,
    maxBytes = 16 * 1024 * 1024,
): Promise<ProcessOutput> {
    if (process.platform === "win32")
        return Promise.reject(
            new Error("The contract runner requires POSIX process groups."),
        );
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
            cwd,
            env,
            stdio: "pipe",
            detached: true,
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let bytes = 0;
        let settled = false;
        function stopGroup(): void {
            if (child.pid === undefined) return;
            try {
                process.kill(-child.pid, "SIGKILL");
            } catch (error: unknown) {
                if (!(
                    error instanceof Error &&
                    "code" in error &&
                    error.code === "ESRCH"
                ))
                    throw error;
            }
        }
        function fail(error: Readonly<Error>): void {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                stopGroup();
            } catch (cleanup: unknown) {
                reject(
                    cleanup instanceof Error
                        ? cleanup
                        : new Error(String(cleanup)),
                );
                return;
            }
            reject(error);
        }
        const timer = setTimeout(() => {
            fail(new Error("Test process timed out outside assertions."));
        }, timeoutMs);
        child.stdout.on("data", (chunk: Readonly<Buffer>): void => {
            bytes += chunk.length;
            if (bytes > maxBytes)
                fail(new Error("Test output exceeded its byte budget."));
            else stdout.push(chunk);
        });
        child.stderr.on("data", (chunk: Readonly<Buffer>): void => {
            bytes += chunk.length;
            if (bytes > maxBytes)
                fail(new Error("Test output exceeded its byte budget."));
            else stderr.push(chunk);
        });
        child.once("error", fail);
        child.once("exit", (): void => {
            try {
                stopGroup();
            } catch (error: unknown) {
                fail(error instanceof Error ? error : new Error(String(error)));
            }
        });
        child.once("close", (code, signal): void => {
            if (settled) return;
            if (signal !== null || code === null) {
                fail(
                    new Error(
                        `Test process failed outside assertions: ${signal ?? "no exit status"}`,
                    ),
                );
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve({
                code,
                stdout: Buffer.concat(stdout).toString("utf8"),
                stderr: Buffer.concat(stderr).toString("utf8"),
            });
        });
    });
}
