# TODO

## 1. Mutation / readonly rules
- [x] Unmarked object references are readonly, including locals. `Mut<T>` grants shallow access; `MutDeep<T>` grants descendant access. Both are type-only and add no runtime checks.
- [x] `mycoscope/no-foreign-mutation` checks writes and known builtin mutators by their resolved declarations. Aliases, literal computed calls, `call`/`apply`, and Reflect are covered. Binding builtin mutators is conservatively rejected.
- [x] `mycoscope/no-permission-escalation` checks annotations, assignments, defaults, class fields, calls/constructors, callbacks and returns (including overloads). Fresh shells do not authorize borrowed descendants. Field-level markers grant access to nested references.
- [x] Replace `functional/prefer-immutable-types`: writable parameters are now explicit legal contracts. Readonly-by-default is checked at use/transfer sites instead of requiring every parameter annotation to be deeply readonly.
- [x] Meta-test requires behavioral coverage for every effective enabled ESLint rule, including presets. Preset smoke tests pin a violation and control; TS parser rejection covers legacy octal syntax before ESLint can visit it. CI runs lint, typecheck, tests and build.
- [ ] Scalar-field allowlists remain a separate design choice; `Mut<T>` authorizes all direct fields. It does not mean only fields that lacked `readonly` in T.
- [ ] External implementations remain a trust boundary. Unknown library methods may mutate internal state; no complete effect proof is claimed. Graph external-call facts (below) should expose that uncertainty.
- [ ] Deep iteration through library callback APIs remains conservative; prefer explicit `for...of` for mutation. Opaque identity-bearing handles are still a separate contract.
- [ ] `Handle<T>` (previously decided): identity alias for library objects that cannot be copied. Do not treat a marker as proof that unknown methods are harmless.
- [ ] `thaw`: `structuredClone(readonlyParam)` retains readonly types, especially arrays. Add a narrowly trusted helper only when a real use needs it; a deep writable cast is legitimate only for data the helper actually creates.
- [ ] `WritableDeep` is for data shapes; class private fields and arbitrary library internals need explicit APIs/handles rather than mapped-type claims.
