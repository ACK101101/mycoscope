// @ts-check
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import unicorn from "eslint-plugin-unicorn";

// Restrict syntax that complicates dependency resolution for the graph builder.
// The builder must record an unresolved edge when it cannot resolve a dependency.
const unresolvableSyntax = [
    {
        // Reject computed calls such as obj[key](). Allow literal keys such as arr[0]().
        selector:
            "CallExpression[callee.type='MemberExpression'][callee.computed=true][callee.property.type!='Literal']",
        message:
            "Computed call target is unresolvable. Use a Map/record of named functions and call the looked-up value explicitly.",
    },
    {
        // Reject dynamic imports, including those with literal module names.
        selector: "ImportExpression",
        message: "Dynamic import() is unresolvable. Use a static import.",
    },
    {
        // Reject wildcard re-exports so imports refer to the defining module.
        selector: "ExportAllDeclaration",
        message:
            "Barrel re-exports hide real dependency edges and cause cycles. Import from the defining file.",
    },
    {
        // Reject named re-exports so imports refer to the defining module.
        selector: "ExportNamedDeclaration[source]",
        message:
            "Re-exports hide real dependency edges. Import from the defining file.",
    },
    {
        // Reject Reflect member access because it can hide call targets.
        selector: "MemberExpression[object.name='Reflect']",
        message:
            "Reflect enables indirect calls the graph cannot follow. Call the function directly.",
    },
];

export default defineConfig(
    // Exclude this config because it is outside the TypeScript project.
    { ignores: ["eslint.config.js", "dist"] },
    // Apply recommended JavaScript correctness checks.
    eslint.configs.recommended,
    // Apply strict TypeScript checks, including unsafe any usage and unhandled promises.
    tseslint.configs.strictTypeChecked,
    // Apply the TypeScript preset for consistent syntax.
    tseslint.configs.stylisticTypeChecked,
    {
        // Report eslint-disable comments that suppress no diagnostics.
        linterOptions: { reportUnusedDisableDirectives: "error" },
        plugins: {
            "@eslint-community/eslint-comments": eslintComments,
            unicorn,
        },
        languageOptions: {
            parserOptions: {
                // Use tsconfig.json to supply type information to ESLint rules.
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Escape hatches: allowed only with a stated reason
            // Require a reason and explicit rule names for eslint-disable comments.
            "@eslint-community/eslint-comments/require-description": "error",
            "@eslint-community/eslint-comments/no-unlimited-disable": "error",
            // Require a description for @ts-expect-error. Ban other TypeScript check directives.
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
            // Autofix type-only imports into separate import type statements.
            // This keeps type dependencies separate from runtime dependencies.
            "@typescript-eslint/consistent-type-imports": [
                "error",
                { fixStyle: "separate-type-imports" },
            ],

            // Type contracts
            // Require explicit return types so function contracts are visible at the declaration.
            "@typescript-eslint/explicit-function-return-type": "error",
            // Use narrowing instead of type assertions. Const assertions remain allowed.
            "@typescript-eslint/consistent-type-assertions": [
                "error",
                { assertionStyle: "never" },
            ],
            // Require switches to handle every union member.
            "@typescript-eslint/switch-exhaustiveness-check": "error",

            // Control flow and conversions
            // Prefer explicit control flow and conversions. Document exceptions with a rule-specific disable.
            "no-nested-ternary": "error", // Use if/else or a named helper.
            eqeqeq: ["error", "always"], // Require equality checks without type coercion.
            "no-implicit-coercion": "error", // Use Boolean(x) and Number(x) instead of !!x and +x.
            "no-bitwise": "error", // Require an explicit exception for bitwise operations.
            "no-sequences": "error", // Reject comma expressions that combine operations.
            "no-return-assign": "error", // Reject unparenthesized assignments in return statements.
            // TRIAL (this repo only, not in the export): conditions must be booleans, not truthy/falsy.
            "@typescript-eslint/strict-boolean-expressions": [
                "error",
                {
                    allowString: false,
                    allowNumber: false,
                    allowNullableObject: false,
                },
            ],
            // Opt-in, rule by rule: we never spread unicorn's preset.
            // The default exempts "simple" callbacks such as `(a, b) => a + b`; we want those as loops too.
            "unicorn/no-array-reduce": [
                "error",
                { allowSimpleOperations: false },
            ],
            "unicorn/no-for-each": "error", // for...of can break, return and await; forEach can't
            // `.map(parseInt)` type-checks but passes the index as the radix; name the call instead.
            "unicorn/no-array-callback-reference": "error",
            "unicorn/no-negated-condition": "error", // `if (!a) x else y` -> `if (a) y else x`
            "unicorn/no-lonely-if": "error", // `if (a) { if (b) … }` -> `if (a && b)`
            "unicorn/no-useless-else": "error", // no `else` after return/throw: the rest is the else
            // Default depth 3: `f(g(h(x)))` is fine, one more is a named intermediate.
            "unicorn/max-nested-calls": "error",
            "unicorn/no-unreadable-array-destructuring": "error", // `const [,, third] = xs`
            "unicorn/no-unreadable-object-destructuring": "error",
            "unicorn/no-unreadable-iife": "error",
            "unicorn/no-unreadable-new-expression": "error",
            "unicorn/no-unreadable-for-of-expression": "error",

            // Graph completeness: ban what the builder can't resolve
            // TypeScript's parser rejects these constructs before ESLint rules can run.
            "no-octal": "off",
            "no-nonoctal-decimal-escape": "off",
            "no-restricted-syntax": ["error", ...unresolvableSyntax],
            "no-eval": "error", // Reject code execution from strings.
            "no-new-func": "error", // Reject code execution from strings.

            // Size limits remain disabled. Review decomposition manually to avoid
            // encouraging abstractions created only to satisfy a numeric limit.
            // complexity: ['error', 10], // branching paths per function
            // 'max-depth': ['error', 3], // nested blocks
            // 'max-params': ['error', 4], // parameter count
            // 'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
            // 'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
        },
    },
);
