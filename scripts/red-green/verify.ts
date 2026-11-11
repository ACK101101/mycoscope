import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEvidence, sameInventory } from "./evidence.ts";
import {
    ancestor,
    behavior,
    changed,
    files,
    git,
    requireCommit,
    same,
    sameTree,
    testsOnly,
    textAt,
} from "./git.ts";
import { parseManifest, type Manifest } from "./model.ts";
import { replay } from "./replay.ts";

export interface Options {
    readonly repository: string;
    readonly base: string;
    readonly head: string;
    readonly trunk: string;
    readonly dependencyRoot: string;
}
export interface ContractReport {
    readonly file: string;
    readonly baseline: string;
    readonly testsCommit: string;
    readonly baselineValidated: boolean;
    readonly candidateValidated: boolean;
}
export interface Verification {
    readonly status: "verified" | "preparation" | "rejected";
    readonly contracts: readonly ContractReport[];
    readonly errors: readonly string[];
}
interface Plan {
    readonly file: string;
    readonly manifest: Manifest;
    readonly testsCommit: string;
    readonly testFiles: readonly string[];
    readonly frozen: readonly string[];
}
function plan(options: Options, file: string): Plan {
    const { repository, head, trunk } = options;
    const manifest: Manifest = parseManifest(
        JSON.parse(textAt(repository, head, file)),
    );
    requireCommit(repository, manifest.baseline);
    const testsCommit = git(repository, [
        "log",
        "-1",
        "--format=%H",
        head,
        "--",
        file,
    ]).trim();
    requireCommit(repository, testsCommit);
    if (
        !ancestor(repository, trunk, manifest.baseline) ||
        !ancestor(repository, manifest.baseline, options.base) ||
        !ancestor(repository, manifest.baseline, testsCommit) ||
        manifest.baseline === testsCommit ||
        !ancestor(repository, testsCommit, head)
    )
        throw new Error(`Invalid baseline/tests/candidate ancestry: ${file}`);
    const commits = git(repository, [
        "rev-list",
        "--reverse",
        `${manifest.baseline}..${testsCommit}`,
    ])
        .trim()
        .split("\n");
    for (const sha of commits) {
        const parents = git(repository, [
            "rev-list",
            "--parents",
            "-n",
            "1",
            sha,
        ])
            .trim()
            .split(" ")
            .slice(1);
        const parent = parents[0];
        if (
            parents.length !== 1 ||
            parent === undefined ||
            changed(repository, parent, sha).some((path) => !testsOnly(path))
        )
            throw new Error(
                `Tests phase contains source, configuration, harness edits or a merge: ${file}`,
            );
    }
    const frozen = changed(repository, manifest.baseline, testsCommit);
    if (!sameTree(repository, testsCommit, head, "tests/harness"))
        throw new Error(`Shared harness changed after tests: ${file}`);
    for (const path of frozen)
        if (!same(repository, testsCommit, head, path))
            throw new Error(
                `Frozen tests/support/manifest changed after tests: ${path}`,
            );
    const declared = new Set(manifest.cases.map((item) => item.file));
    for (const path of frozen)
        if (path.endsWith(".test.ts") && !declared.has(path))
            throw new Error(
                `Changed test file has no declared outcomes: ${path}`,
            );
    const testFiles = files(repository, testsCommit).filter(
        (path) =>
            /^tests\/.+\.test\.ts$/.test(path) &&
            !path.startsWith("tests/fixtures/"),
    );
    for (const path of declared)
        if (!testFiles.includes(path))
            throw new Error(`Declared test file is absent: ${path}`);
    return { file, manifest, testsCommit, testFiles, frozen };
}
export async function verify(options: Options): Promise<Verification> {
    const reports: ContractReport[] = [];
    const errors: string[] = [];
    const workspace = mkdtempSync(join(tmpdir(), "mycoscope-red-green-"));
    try {
        for (const sha of [options.base, options.head, options.trunk])
            requireCommit(options.repository, sha);
        if (
            !ancestor(options.repository, options.trunk, options.base) ||
            !ancestor(options.repository, options.base, options.head)
        )
            throw new Error(
                "Trunk, PR base and candidate must have ordered ancestry.",
            );
        const manifests = files(options.repository, options.head).filter(
            (file) => /^\.red-green\/[a-zA-Z0-9_-]+\.json$/.test(file),
        );
        const plans: Plan[] = [];
        for (const file of manifests) {
            const testsCommit = git(options.repository, [
                "log",
                "-1",
                "--format=%H",
                options.head,
                "--",
                file,
            ]).trim();
            if (!ancestor(options.repository, testsCommit, options.trunk))
                plans.push(plan(options, file));
        }
        const delta = changed(options.repository, options.base, options.head);
        if (plans.length === 0) {
            if (delta.some((file) => behavior(file)))
                throw new Error(
                    "Behavior changes require a RED/GREEN contract.",
                );
            return { status: "preparation", contracts: [], errors: [] };
        }
        const covered = new Set(plans.flatMap((item) => item.frozen));
        for (const file of delta)
            if (testsOnly(file) && !covered.has(file))
                throw new Error(
                    `Tests changed outside a declared tests phase: ${file}`,
                );
        for (const [index, item] of plans.entries()) {
            const baseline = await replay(
                options.repository,
                item.manifest.baseline,
                item.testsCommit,
                item.testFiles,
                join(workspace, `${String(index)}-baseline`),
                options.dependencyRoot,
            );
            const baselineErrors = checkEvidence(
                item.manifest,
                baseline.transcript,
                "baseline",
                baseline.exitCode,
            );
            errors.push(
                ...baselineErrors.map((error) => `${item.file}: ${error}`),
            );
            let candidateValidated = false;
            if (baselineErrors.length === 0) {
                const candidate = await replay(
                    options.repository,
                    options.head,
                    item.testsCommit,
                    item.testFiles,
                    join(workspace, `${String(index)}-candidate`),
                    options.dependencyRoot,
                );
                const candidateErrors: string[] = [
                    ...checkEvidence(
                        item.manifest,
                        candidate.transcript,
                        "candidate",
                        candidate.exitCode,
                    ),
                ];
                if (!sameInventory(baseline.transcript, candidate.transcript))
                    candidateErrors.push(
                        "Candidate executed a different case inventory from the baseline.",
                    );
                errors.push(
                    ...candidateErrors.map((error) => `${item.file}: ${error}`),
                );
                candidateValidated = candidateErrors.length === 0;
            }
            reports.push({
                file: item.file,
                baseline: item.manifest.baseline,
                testsCommit: item.testsCommit,
                baselineValidated: baselineErrors.length === 0,
                candidateValidated,
            });
        }
        return {
            status: errors.length === 0 ? "verified" : "rejected",
            contracts: reports,
            errors,
        };
    } catch (error: unknown) {
        return {
            status: "rejected",
            contracts: reports,
            errors: [
                ...errors,
                error instanceof Error ? error.message : String(error),
            ],
        };
    } finally {
        rmSync(workspace, { recursive: true, force: true });
    }
}
