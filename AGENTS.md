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

- Name the domain concept and its role: `ExpectedDiagnostic`, `ActualDiagnostic`, and `TestCase`, rather than `Expected`, `Found`, and `Case`.
- Name the full contents of a value. `DiagnosticIdentity` includes the ID, location, and source text; calling it `Position` would hide part of its meaning.
- Use verbs for actions and nouns for values or pure projections. Examples: `assertDiagnosticsMatch` and `diagnosticIdentity`.
- Make conversions explicit about their result or direction: `toActualDiagnostic`, `offsetFromLocation`, and `locationFromOffset`.
- Name test registration functions for that action: `testLintRule` and `testCompilerOption`.
- Include units or representation when useful: `SNIPPET_PATH` is a path, not source code.
- Use the same name for the same concept across adapters. Preserve external API names and established tool names.
- Prefer clearer names before adding explanatory comments. Do not introduce abstractions solely to shorten names.

After changing comments or names, inspect callers and comments for stale terminology. Run typecheck, lint, and the existing tests for code renames.
