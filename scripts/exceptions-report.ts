import { execFileSync } from "node:child_process";
import { findExceptionChanges, renderComment } from "./exceptions.ts";

// Usage: tsx scripts/exceptions-report.ts <base-ref>
// Read the diff and source files from the same Git snapshots.
function git(args: readonly string[]): string {
    return execFileSync("git", args, { encoding: "utf8" });
}

const baseRef = process.argv[2];
if (baseRef === undefined) {
    throw new Error("Usage: tsx scripts/exceptions-report.ts <base-ref>");
}
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
console.log(renderComment(changes));
