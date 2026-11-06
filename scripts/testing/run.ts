import { spawnSync } from "node:child_process";
import type { Selection } from "./selection.ts";

function main(): number {
    const args = process.argv.slice(2);
    const allowed = new Set(["--integration", "--all", "--ci"]);
    if (args.some((arg) => !allowed.has(arg)))
        throw new Error(
            "Use --integration, --all or --ci; targeted tests can use Node's runner directly.",
        );
    let selection: Selection = "unit";
    if (args.includes("--integration")) selection = "integration";
    if (args.includes("--all")) selection = "all";
    const entries =
        selection === "all"
            ? ["tests/suites/unit.ts", "tests/suites/integration.ts"]
            : [`tests/suites/${selection}.ts`];
    const reporter = new URL("./runtime-reporter.ts", import.meta.url);
    const result = spawnSync(
        process.execPath,
        [
            "--max-old-space-size=1024",
            "--import",
            import.meta.resolve("tsx"),
            "--test",
            `--test-concurrency=${args.includes("--ci") ? "2" : "1"}`,
            "--test-reporter=spec",
            `--test-reporter=${reporter.href}`,
            "--test-reporter-destination=stdout",
            "--test-reporter-destination=stderr",
            ...entries,
        ],
        { cwd: process.cwd(), stdio: "inherit" },
    );
    if (result.error !== undefined) throw result.error;
    return result.status ?? 1;
}
try {
    // eslint-disable-next-line mycoscope/no-foreign-mutation -- This CLI owns the process exit status returned by the actual Node test runner.
    process.exitCode = main();
} catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    // eslint-disable-next-line mycoscope/no-foreign-mutation -- Invalid runner inputs/setup must return nonzero; runtime budget warnings never change this status.
    process.exitCode = 1;
}
