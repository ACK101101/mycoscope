# Implementation and testing

- Treat implementation choices as replaceable. Do not preserve compatibility, abstractions, or historical structure without a current requirement.
- Before extending a subsystem, consider whether removing or replacing it would produce a smaller, clearer implementation.
- Preserve intentional behavior through tests. Update tests when requirements change; avoid assertions tied only to internal structure.
- Use upstream tools before adding custom policy or analysis. Document what custom checks establish and where they fail.
- Keep tests fast, deterministic, and independent. Exercise real integrations where substitution could hide a meaningful failure.
- Add infrastructure and abstraction to solve a demonstrated problem. Remove obsolete implementation and its supporting machinery together.

# Comments and names

Apply these conventions to code and configuration in this repository.

## Comments

- Use plain technical English, complete sentences, and concrete subjects and verbs.
- Keep each sentence focused on one fact. Keep the explanation needed to understand why the code exists.
- Explain constraints, exceptions, and behavior that the code does not make obvious. Remove comments that only repeat a clear name or operation.
- Identify workarounds explicitly. State what limitation they address and how they work. Mention removal conditions only when known.
- Name the specific tool, config, or value. Avoid vague terms such as "real config," "plumbing," "silent," and "magic."
- Describe only what the implementation guarantees. Do not claim complete isolation, coverage, or CI enforcement without checking it.
- Preserve directive comments and fixture locations when tests depend on them. 

Example from the lint harness:

```ts
// Harness workaround: give in-memory source a path so ESLint applies Mycoscope's
// lint settings. No file is written. allowDefaultProject below lets the TypeScript
// project service use tsconfig.json for source outside the project.
const SNIPPET_PATH = "tests/snippets/case.ts";
```

## Names

- Name the domain concept and its role: `ExpectedDiagnostic` and `ActualDiagnostic`, rather than `Expected` and `Found`.
- Name the full contents of a value. `DiagnosticIdentity` includes the ID, location, and source text; calling it `Position` would hide part of its meaning.
- Use verbs for actions and nouns for values or pure projections. Examples: `assertDiagnosticsMatch` and `diagnosticIdentity`.
- Make conversions explicit about their result or direction: `toActualDiagnostic`, `offsetFromLocation`, and `locationFromOffset`.
- Name tool adapters for execution: `lintRule`, `lintSyntaxRestriction`, and `compileWithOption`. Test files register ordinary `test(...)` callbacks and assert their results.
- Include units or representation when useful: `SNIPPET_PATH` is a path, not source code.
- Use the same name for the same concept across adapters. Preserve external API names and established tool names.
- Prefer clearer names before adding explanatory comments. Do not introduce abstractions solely to shorten names.

After changing comments or names, inspect callers and comments for stale terminology. Run typecheck, lint, and the existing tests for code renames.

## File layout

- Group tests by the tool they exercise: `tests/eslint/` and `tests/typescript/`.
- Group files at the same level by a consistent role. ESLint rule tests belong in `tests/eslint/individual-rules/`, linter-option tests in `tests/eslint/linter-options/`, and compiler-option tests in `tests/typescript/compiler-options/`.
- Keep shared execution and assertion machinery in `tests/harness/`. Test files describe cases and call the adapters.
- Let location identify the owning tool, filenames identify the behavior, and signatures identify inputs and outputs.
- Use one execution path for individual-rule tests. Keep source snippets beside their expectations in the test file. Input storage does not define a separate test category.
- Test individual rules and options for now. Add combined-config tests only when a concrete interaction needs coverage; assert the complete diagnostic result rather than filtering to one rule.
