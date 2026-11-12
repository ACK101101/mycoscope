# Mycoscope

## Running tests

`npm test` runs every test in one process so ESLint and TypeScript setup can be
reused across files. Tests share module state and globals. Tests that need process
isolation launch their own subprocesses. Run a specific file with
`node --import tsx --test tests/path.test.ts`.

Use `node:test` and `node:assert/strict` throughout. Unit tests call repository
functions directly with explicit inputs and expected results. Integration tests
exercise a real tool through its API or CLI with controlled inputs and expected
results. Keep configuration-inventory checks separate from behavior tests.

CLI integration tests use a temporary project, run the command with that project
as its working directory, check its exit status and structured output, and remove
the project in `finally`. Keep subprocesses for CLI behavior or process isolation.
Share tool adapters when needed; do not make unit tests use a fixture framework.

## Readonly inputs

Function parameters use readonly types by default. ESLint's
`@typescript-eslint/prefer-readonly-parameter-types` checks explicitly typed
parameters, including nested properties and array elements. Use TypeScript's
`readonly`, `ReadonlyArray`, `ReadonlyMap`, and `ReadonlySet`, or type-fest's
`ReadonlyDeep` for nested data.

Local builders and accumulators can use ordinary mutable types. A function that
intentionally changes an input keeps a mutable parameter type and adds a
rule-specific ESLint exception with a reason. Exceptions appear in the PR report.
For mapped writable types, use type-fest's `Writable` or `WritableDeep`.

This checks input type declarations; it does not prove that a function has no
mutation or other side effects:

- Inferred callback parameters retain their library contracts and are not checked
  by this rule.
- Methods remain callable. A readonly object can expose methods that change its
  state, including methods on `Date` and user-defined classes.
- Treating methods as readonly also allows mutable `Map` and `Set` inputs. Prefer
  `ReadonlyMap` and `ReadonlySet` at read-only boundaries; this distinction is a
  convention, not enforced by the configured rule.
- TypeScript permits readonly object properties to flow into writable aliases.
- Readonly types do not freeze objects, copy data, establish exclusive ownership,
  or prevent other references from modifying the same data.

There are no custom mutation-permission types or ownership checks.
