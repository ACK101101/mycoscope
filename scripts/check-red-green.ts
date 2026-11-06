import type { Mut } from "../src/mutation.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verify } from "./red-green/verify.ts";

async function main(): Promise<void> {
    try {
        const args = process.argv.slice(2);
        const values: Mut<Map<string, string>> = new Map();
        const allowed = new Set([
            "--repo",
            "--base",
            "--head",
            "--trunk",
            "--dependencies",
        ]);
        for (let index = 0; index < args.length; index += 2) {
            const flag = args[index];
            const value = args[index + 1];
            if (
                flag === undefined ||
                !allowed.has(flag) ||
                values.has(flag) ||
                value === undefined
            )
                throw new Error(
                    "Use --repo PATH --base SHA --head SHA --trunk SHA [--dependencies PATH].",
                );
            values.set(flag, value);
        }
        const repository = values.get("--repo");
        const base = values.get("--base");
        const head = values.get("--head");
        const trunk = values.get("--trunk");
        if (
            repository === undefined ||
            base === undefined ||
            head === undefined ||
            trunk === undefined
        )
            throw new Error(
                "Missing repository, PR base, candidate or trunk SHA.",
            );
        const defaultDependencies = fileURLToPath(
            new URL("../", import.meta.url),
        );
        const report = await verify({
            repository: resolve(repository),
            base,
            head,
            trunk,
            dependencyRoot: resolve(
                values.get("--dependencies") ?? defaultDependencies,
            ),
        });
        console.log(JSON.stringify(report, null, 2));
        // eslint-disable-next-line mycoscope/no-foreign-mutation -- Node exposes CLI exit status as a writable process global.
        process.exitCode = report.status === "rejected" ? 1 : 0;
    } catch (error: unknown) {
        console.log(
            JSON.stringify({
                status: "rejected",
                errors: [
                    error instanceof Error ? error.message : String(error),
                ],
            }),
        );
        // eslint-disable-next-line mycoscope/no-foreign-mutation -- Command-line argument/setup failures must return nonzero to CI.
        process.exitCode = 1;
    }
}
await main();
