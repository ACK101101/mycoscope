# Lint and compile guardrails

A strict TypeScript and ESLint setup meant to keep code followable by name, for humans and
agents. Copy this folder's contents into a new repo root, then:

```sh
npm install        # or merge devDependencies and scripts into your own package.json
npm run typecheck  # tsc --noEmit
npm run lint       # eslint, zero warnings allowed
npm run format     # prettier --write (format:check is what CI runs)
```

## What is in here

| Path                                                         | Purpose                                                                                                                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.base.json`                                         | Strictness flags only. Portable; change rarely.                                                                                                                                                                 |
| `tsconfig.json`                                              | Per-repo plumbing (`lib`, `module`, `types`, `include`). Edit for your environment, e.g. add `"DOM"` to `lib` and set `jsx` for a React app.                                                                    |
| `eslint.config.js`                                           | Flat config: typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`, escape-hatch discipline, plain-code rules, followability bans. Applies to `*.ts` / `*.tsx` only.                                   |
| `.prettierrc`, `.prettierignore`                             | 4 spaces, double quotes; JSON and YAML use 2 spaces so npm does not fight the formatter. Prettier runs beside ESLint, not inside it. None of the ESLint rules here are formatting rules, so nothing conflicts. |
| `.vscode/`                                                   | Prettier as the TypeScript formatter, ESLint fix-on-save, extension recommendations.                                                                                                                            |
| `.github/workflows/check.yml`                                | CI: typecheck, lint, format check.                                                                                                                                                                              |
| `.github/workflows/exceptions.yml`, `scripts/exceptions*.ts` | PR comment listing every `eslint-disable` / `@ts-expect-error` / `@ts-ignore` the PR adds, with its reason. This is what makes "disable only with a reason" reviewable.                                         |

## Known limits

- Not included on purpose: mutation/readonly rules and Effect rules (still being tested upstream),
  `strict-boolean-expressions` (trialled upstream first).
