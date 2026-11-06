# Running tests

- `npm test`: fast rule/unit cases, in one process.
- `npm run test:integration`: real CLI, upstream Effect diagnostics and Git-history replay checks.
- `npm run test:all`: both groups, serially.
- `npm run test:ci`: both groups, at most two processes. This is the required verification workflow command.

Test filenames ending in `.integration.test.ts` belong to integrations. Register every test file in the corresponding explicit entry under `tests/suites/`. The inventory test rejects missing or duplicate imports. Targeted checks can still use `node --import tsx --test tests/path.test.ts`.

`test-budgets.json` sets soft limits: 100 ms per case and 10 seconds for the complete run. Exceeding a limit emits a local warning or a GitHub Actions warning annotation, preserving the test's real exit status. Overall timing includes module loading and setup; integration checks can legitimately exceed these budgets and remain required.

The local runner caps V8 heap at 1 GiB and runs one suite at a time. CI allows two suite processes. Do not overlap full local runs: native compiler memory and subprocesses also contribute to RSS beyond the V8 heap cap.

Typed fixtures reuse a versioned TypeScript language service and parsed dependency documents. Each case still obtains a fresh program state and runs its diagnostics; results are not cached. A cold-versus-warm regression covers source edits and module additions/removals. Lint snippets and legacy fixtures use small projects extending the actual root compiler configuration.

Measured on the development machine: 513 fast cases in 8.5 seconds, with approximately 1.25 GiB peak RSS; 31 integration cases in 31.3 seconds. These are observations, not hard performance guarantees. Previously the full serial run took about 102 seconds, dominated by repeated compiler setup.
