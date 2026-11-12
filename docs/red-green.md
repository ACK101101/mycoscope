# Frozen RED/GREEN contracts

`npm test` runs every test through Node's shared-process runner, locally and in CI. Tests that need isolation launch subprocesses.

Contract replay is serial, with a 768 MiB V8 heap limit per process, a three-minute phase timeout and bounded output. It runs only on POSIX hosts (macOS/Linux).

## One pair, two reviews

1. Start from a green baseline commit. Add the tests and a uniquely named `.red-green/<change>.json`. Commit only tests, fixtures and this manifest. Shared harness changes belong in a separate green preparation change.
2. Open a tests-only PR. Its ordinary CI should be red. The contract report must say the baseline produced the declared assertion failures; setup failures are not evidence. The report stays rejected until the candidate is green.
3. Stack a behavior PR on that tests commit. Leave tests, support files, the manifest and shared harness unchanged. The verifier reruns the frozen suite against the baseline and candidate.
4. Review the tests independently, then the implementation. Merge behavior into the tests branch; once the combined branch is green, merge that PR into its base. Use the pair as one landing unit, so red tests never land on main alone.

The verifier identifies the tests commit as the last commit that changed the manifest. The baseline must already be an ancestor of the PR base; moving it forward to conceal earlier source edits is rejected. Bring the stack up to date with the default branch before verification. Every commit between baseline and tests must contain only test/fixture/manifest edits; source edits that are later reverted still invalidate the phase. Merge commits during the tests phase are rejected. Later implementation merges are supported. Contracts already contained in the default branch are retired; future changes can edit those tests normally.

Use a separate case file per pair while stacking work. Two unlanded pairs cannot independently rewrite the same frozen case file. Give tests unique names within each entry file; the identity is the entry file plus test name, including tests declared through shared helpers.

## Manifest

```json
{
  "version": 1,
  "baseline": "0123456789012345678901234567890123456789",
  "cases": [
    {
      "file": "tests/strict-equality.test.ts",
      "name": "loose equality is rejected",
      "claim": "strict-equality",
      "baseline": {
        "status": "fail",
        "assertion": {
          "operator": "deepStrictEqual",
          "actual": [],
          "expected": ["eqeqeq"]
        }
      }
    },
    {
      "file": "tests/strict-equality.test.ts",
      "name": "strict equality remains accepted",
      "claim": "strict-equality",
      "baseline": { "status": "pass" }
    }
  ]
}
```

Use the real full commit SHA and the real assertion data. Assertion values must be plain JSON data; use observable diagnostics, booleans or strings instead of opaque objects. Change-sensitive expectations must use `assertBehaviorEqual` from `tests/harness/behavior.ts`; the lint/compiler helpers already do. Its `operator` is `deepStrictEqual`. Ordinary Node assertions do not qualify as RED evidence: an assertion in setup must not accidentally prove a behavior claim. The reporter compares actual/expected data structurally, avoiding formatted error-message differences. Inspect a failed assertion's `operator`, `actual` and `expected` when authoring the manifest; do not edit the test to fit an unrelated failure.

Each claim needs at least one case that fails on the baseline. Controls can pass in both phases. All cases in a selected file must be declared, and every changed `.test.ts` file in the tests phase must be represented. Other pre-existing tests must pass. Every frozen test must pass on the candidate. Missing cases, unexpected cases, duplicate identities, skips, TODOs, cancellations, wrong assertions and setup/process failures invalidate the proof. Adding or weakening tests during implementation is rejected.

The suite comes from the tests commit's `tests/` tree in both runs. Production source and compiler/lint configuration come from the respective baseline/candidate. Snapshots copy exact Git blobs, honoring neither checkout filters nor archive export attributes. Symlinks and submodules in snapshots are rejected. Matching dependency installations can be reused; changed lockfiles are installed with `npm ci --ignore-scripts` in the disposable snapshot. Native packages needing lifecycle scripts require explicit preparation rather than treating a failed install as RED.

## Running and trusting the gate

```sh
npm run check:red-green -- \
  --repo . --base <pr-base-sha> --head <candidate-sha> --trunk <default-branch-sha>
```

The gate reports `verified`, `preparation` or `rejected`. A preparation change has no active contract and changes no application/rule/script/compiler/lint/package behavior paths (for example documentation or test harness preparation). It receives no RED/GREEN proof claim. All paths outside the explicit preparation exemptions require a contract, including new or unknown policy/configuration files. Preparation exemptions are tests, docs, Markdown, valid contract manifests, `.gitignore` and license files. Harness preparation still needs review and the ordinary full test suite.

The CI controller and reporter are loaded from the default branch, not the proposed implementation. The workflow uses read-only permissions, no secrets or caches, and no persisted checkout credentials. Test processes receive an isolated home/temp directory and a small environment without caller preloads, GitHub command files or credential variables. Production code and tests execute without sandboxing; this is a regression-evidence mechanism for reviewed code, not a hostile-code isolation service. Do not add secrets or write permissions to this workflow.

After this bootstrap is reviewed and merged to the default branch, require both `verify` and `red-green` status checks in branch protection. Existing stack PRs predate this verifier; requiring the new status before bootstrap lands would block them. Repository protection is deliberately not changed by this PR. The initial checker bootstrap is reviewed and tested normally; it cannot use itself as historical proof before it exists.

A green gate proves the same tests distinguish these two versions and remain intact. Test completeness and the correctness of the expectations still require human judgment. Commit ancestry establishes committed order, not when implementation was written in an editor.
