import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { commitId, record } from "./model.ts";
import { isDeepStrictEqual } from "node:util";

export function git(repository: string, args: readonly string[]): string {
    return execFileSync(
        "git",
        ["--no-replace-objects", "-C", repository, ...args],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 30000 },
    );
}
export function requireCommit(repository: string, sha: string): void {
    if (!commitId(sha))
        throw new Error("Use a full commit SHA, not a mutable branch name.");
    git(repository, ["cat-file", "-e", `${sha}^{commit}`]);
}
export function ancestor(
    repository: string,
    older: string,
    newer: string,
): boolean {
    const base = git(repository, ["merge-base", older, newer]).trim();
    return base === older;
}
export function files(repository: string, sha: string): readonly string[] {
    return git(repository, ["ls-tree", "-r", "--name-only", "-z", sha])
        .split("\0")
        .filter((file) => file.length > 0);
}
export function changed(
    repository: string,
    older: string,
    newer: string,
): readonly string[] {
    return git(repository, [
        "diff",
        "--no-renames",
        "--name-only",
        "-z",
        older,
        newer,
    ])
        .split("\0")
        .filter((file) => file.length > 0);
}
export function blob(repository: string, sha: string, file: string): string {
    return git(repository, ["rev-parse", "--verify", `${sha}:${file}`]).trim();
}
export function textAt(repository: string, sha: string, file: string): string {
    return git(repository, ["show", `${sha}:${file}`]);
}
export function same(
    repository: string,
    older: string,
    newer: string,
    file: string,
): boolean {
    const before = git(repository, ["ls-tree", older, "--", file]);
    return (
        before.length > 0 &&
        before === git(repository, ["ls-tree", newer, "--", file])
    );
}
export function sameTree(
    repository: string,
    older: string,
    newer: string,
    directory: string,
): boolean {
    const all = new Set(
        [...files(repository, older), ...files(repository, newer)].filter(
            (file) => file.startsWith(directory + "/"),
        ),
    );
    return [...all].every((file) => same(repository, older, newer, file));
}
export function testsOnly(file: string): boolean {
    return (
        (file.startsWith("tests/") && !file.startsWith("tests/harness/")) ||
        /^\.red-green\/[a-zA-Z0-9_-]+\.json$/.test(file)
    );
}
// Preparation is an explicit exemption; new policy/configuration paths fail closed.
export function behavior(file: string): boolean {
    return !(
        file.startsWith("tests/") ||
        file.startsWith("docs/") ||
        /^\.red-green\/[a-zA-Z0-9_-]+\.json$/.test(file) ||
        file.endsWith(".md") ||
        [".gitignore", "LICENSE", "LICENSE.txt"].includes(file)
    );
}

export function snapshot(
    repository: string,
    sha: string,
    directory: string,
): void {
    const entries = git(repository, ["ls-tree", "-r", "-z", sha])
        .split("\0")
        .filter((entry) => entry.length > 0);
    for (const entry of entries) {
        const tab = entry.indexOf("\t");
        const file = entry.slice(tab + 1);
        if (
            !/^100(?:644|755) blob /.test(entry) ||
            file.startsWith("/") ||
            file.includes("\\") ||
            file
                .split("/")
                .some((part) => part === ".." || part.toLowerCase() === ".git")
        )
            throw new Error(
                `Snapshot requires regular tracked files and safe paths: ${file}`,
            );
    }
    mkdirSync(directory, { recursive: true });
    const objects = entries.map(
        (entry) => entry.slice(0, entry.indexOf("\t")).split(" ")[2] ?? "",
    );
    const contents = execFileSync(
        "git",
        ["--no-replace-objects", "-C", repository, "cat-file", "--batch"],
        {
            input: objects.join("\n") + "\n",
            maxBuffer: 128 * 1024 * 1024,
            timeout: 30000,
        },
    );
    let offset = 0;
    for (const [index, entry] of entries.entries()) {
        const newline = contents.indexOf(10, offset);
        const header = contents.subarray(offset, newline).toString("utf8");
        const match = /^([a-f0-9]{40}) blob (\d+)$/.exec(header);
        if (
            newline < offset ||
            match?.[1] !== objects[index] ||
            match?.[2] === undefined
        )
            throw new Error("Invalid Git batch object header.");
        const size = Number(match[2]);
        const begin = newline + 1;
        const end = begin + size;
        if (
            !Number.isSafeInteger(size) ||
            end >= contents.length ||
            contents[end] !== 10
        )
            throw new Error("Truncated Git batch object.");
        const target = join(directory, entry.slice(entry.indexOf("\t") + 1));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, contents.subarray(begin, end), {
            mode: entry.startsWith("100755") ? 0o755 : 0o644,
        });
        offset = end + 1;
    }
}
function dependencies(value: unknown): unknown {
    if (!record(value)) throw new Error("package.json must be an object.");
    return [
        value["dependencies"],
        value["devDependencies"],
        value["optionalDependencies"],
        value["peerDependencies"],
        value["overrides"],
    ];
}
export function install(
    directory: string,
    dependencyRoot: string,
    environment: Readonly<NodeJS.ProcessEnv>,
): void {
    const localLock = readFileSync(
        join(directory, "package-lock.json"),
        "utf8",
    );
    const trustedLock = readFileSync(
        join(dependencyRoot, "package-lock.json"),
        "utf8",
    );
    const localPackage: unknown = JSON.parse(
        readFileSync(join(directory, "package.json"), "utf8"),
    );
    const trustedPackage: unknown = JSON.parse(
        readFileSync(join(dependencyRoot, "package.json"), "utf8"),
    );
    if (
        localLock === trustedLock &&
        isDeepStrictEqual(
            dependencies(localPackage),
            dependencies(trustedPackage),
        )
    )
        symlinkSync(
            join(dependencyRoot, "node_modules"),
            join(directory, "node_modules"),
            "dir",
        );
    else
        execFileSync(
            "npm",
            ["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
            {
                cwd: directory,
                env: environment,
                timeout: 120000,
                maxBuffer: 4 * 1024 * 1024,
            },
        );
}
