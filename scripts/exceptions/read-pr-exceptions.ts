import { execFileSync } from "node:child_process";
import {
    findExceptionChanges,
    type ExceptionChange,
} from "./detect-directive-changes.ts";

export function readExceptionReport(
    baseRef: string,
    directory = process.cwd(),
): {
    readonly commitId: string;
    readonly changes: readonly ExceptionChange[];
} {
    // Read the diff and source files from the same Git snapshots.
    const git = (args: readonly string[]): string =>
        execFileSync("git", args, { encoding: "utf8", cwd: directory });
    const head = git(["rev-parse", "HEAD"]).trim();
    const base = git(["merge-base", baseRef, head]).trim();
    const diff = git([
        "-c",
        "core.quotePath=false",
        "diff",
        "--no-color",
        "--no-ext-diff",
        "--no-textconv",
        "--find-renames",
        "-U0",
        base,
        head,
    ]);
    const changes = findExceptionChanges(diff, (file, revision) => {
        const commit = revision === "base" ? base : head;
        return git(["show", `${commit}:${file}`]);
    });
    return { commitId: head, changes };
}
