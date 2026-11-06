// @ts-check
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";

// We want static resolution for the graph builder. These are selectors for constructs
// that make this hard. Banning them keeps the call/import graph more complete.
// If a ban is impossible, we must emit an explicit `unresolved` edge instead of
// silently dropping it.
const unresolvableSyntax = [
    {
        // obj[key]() — the callee is computed at runtime. Literal indexes (arr[0]()) are fine.
        selector:
            "CallExpression[callee.type='MemberExpression'][callee.computed=true][callee.property.type!='Literal']",
        message:
            "Computed call target is unresolvable. Use a Map/record of named functions and call the looked-up value explicitly.",
    },
    {
        // import(spec) — the target module can be a runtime value.
        selector: "ImportExpression",
        message: "Dynamic import() is unresolvable. Use a static import.",
    },
    {
        // export * from './x' — hides which symbols cross the module boundary.
        selector: "ExportAllDeclaration",
        message:
            "Barrel re-exports hide real dependency edges and cause cycles. Import from the defining file.",
    },
    {
        // export { x } from './x' — same problem, symbol by symbol.
        selector: "ExportNamedDeclaration[source]",
        message:
            "Re-exports hide real dependency edges. Import from the defining file.",
    },
    {
        // Reflect.apply/get/... — indirect invocation or access by runtime value.
        selector: "MemberExpression[object.name='Reflect']",
        message:
            "Reflect enables indirect calls the graph cannot follow. Call the function directly.",
    },
];

export default defineConfig(
    // This file needs `export default` and isn't in tsconfig, so type-aware linting can't parse it.
    // Fixtures break rules on purpose and sit outside tsconfig; tests/rules.test.ts lints them with `ignore: false`.
    { ignores: ["eslint.config.js", "dist", "tests/fixtures"] },
    // Baseline: JS correctness rules (no-empty, no-useless-catch, no-unused-vars, ...).
    eslint.configs.recommended,
    // Type-aware strict set. Among others it forbids: any and calls on any (a call on `any`
    // is an unresolved edge), non-null `!`, floating promises, throwing non-Errors,
    // unnecessary conditions, and require().
    tseslint.configs.strictTypeChecked,
    // Consistency: Record<> over index signatures, `??` over `||`, etc.
    tseslint.configs.stylisticTypeChecked,
    {
        // Inline disables are allowed but must carry a reason (`-- why`).
        // Disables that surpress nothing error.
        // The CI diff check surfaces every one added for review.
        linterOptions: { reportUnusedDisableDirectives: "error" },
        plugins: {
            "@eslint-community/eslint-comments": eslintComments,
        },
        languageOptions: {
            parserOptions: {
                // Type-aware rules need the compiler; projectService reuses tsconfig.json.
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // ── Escape hatches: allowed only with a stated reason ───────────────────
            // `-- reason` is mandatory on eslint-disable; unscoped (rule-less) disables are banned.
            "@eslint-community/eslint-comments/require-description": "error",
            "@eslint-community/eslint-comments/no-unlimited-disable": "error",
            // '@ts-expect-error' needs a description; @ts-ignore (never fails when fixed) and
            // '@ts-nocheck' (whole file) is banned.
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": "allow-with-description",
                    "ts-ignore": true,
                    "ts-nocheck": true,
                    "ts-check": true,
                },
            ],
            // `x!` asserts non-null without checking. Narrow instead.
            "@typescript-eslint/no-non-null-assertion": "error",
            // `import type` for type-only imports; the fixer writes a separate statement instead of
            // inline `{ type X }`, so value and type edges stay on different lines.
            // verbatimModuleSyntax already errors; this adds the autofix.
            "@typescript-eslint/consistent-type-imports": [
                "error",
                { fixStyle: "separate-type-imports" },
            ],

            // ── Types: make the type system carry the invariants ────────────────────
            // Explicit return types make each function's contract a stated fact, not an inference.
            "@typescript-eslint/explicit-function-return-type": "error",
            // `as` is the type system lying. Parse/narrow instead. (`as const` is still allowed.)
            "@typescript-eslint/consistent-type-assertions": [
                "error",
                { assertionStyle: "never" },
            ],
            // A new union member must break every switch that doesn't handle it.
            "@typescript-eslint/switch-exhaustiveness-check": "error",

            // ── Plain code: syntax that is almost always clever, rarely clearer ─────
            // Proxies for clarity, so they will sometimes misfire. The escape hatch is an inline
            // disable with a reason, which makes the choice visible in the graph.
            "no-nested-ternary": "error", // use if/else or a named helper
            eqeqeq: ["error", "always"], // `==` coerces both sides; `0 == ""` is true
            "no-implicit-coercion": "error", // `!!x` and `+x` hide the conversion; write Boolean(x), Number(x)
            "no-bitwise": "error", // `a | b` is nearly always a typo for `||` or a trick
            "no-sequences": "error", // the comma operator
            "no-return-assign": "error", // `return x = y` reads as a comparison
            // ── Graph completeness: ban what the builder can't resolve ──────────────
            "no-restricted-syntax": ["error", ...unresolvableSyntax],
            "no-eval": "error", // target is a string
            "no-new-func": "error", // target is a string

            // // ── Size and complexity: god functions/files are the usual symptom of band-aids ──
            // // TURNED OFF FOR NOW - I do not want to encourage over abstraction, will currently rely on manual
            // // analysis to keep the code nice and tidy.
            // complexity: ['error', 10], // branching paths per function
            // 'max-depth': ['error', 3], // nested blocks
            // 'max-params': ['error', 4], // more is a missing object type
            // 'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
            // 'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
        },
    },
);
