import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import { ESLint } from "eslint";

const FIXTURES = "tests/fixtures";

// Fixtures named for a rule break exactly that rule on purpose, and must be reported.
// `rule--variant` when one rule has several ways to break. The name check below keeps
// fixture, rule and test lined up. Test rules here so they can not silently stop firing.
// Shared tail of every no-foreign-mutation message.
const COPY =
    "Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.";

// Each fixture pins one expected error from its rule: position and exact message. The rule
// must fire exactly once, there. Other rules may also fire on a fixture (a mutated parameter
// is also a mutable parameter); only the clean fixtures must be silent overall.
const cases: readonly {
    fixture: string;
    ruleId: string | null;
    line: number;
    column: number;
    message: string;
}[] = [
    {
        fixture: "consistent-type-assertions",
        ruleId: "@typescript-eslint/consistent-type-assertions",
        line: 2,
        column: 12,
        message: "Do not use any type assertions.",
    },
    {
        fixture: "no-explicit-any",
        ruleId: "@typescript-eslint/no-explicit-any",
        line: 1,
        column: 22,
        message: "Unexpected any. Specify a different type.",
    },
    {
        fixture: "no-unsafe-call",
        ruleId: "@typescript-eslint/no-unsafe-call",
        line: 3,
        column: 5,
        message: "Unsafe call of an `any` typed value.",
    },
    {
        fixture: "no-non-null-assertion",
        ruleId: "@typescript-eslint/no-non-null-assertion",
        line: 2,
        column: 12,
        message: "Forbidden non-null assertion.",
    },
    {
        fixture: "ban-ts-comment--ts-ignore",
        ruleId: "@typescript-eslint/ban-ts-comment",
        line: 1,
        column: 1,
        message:
            'Use "@ts-expect-error" instead of "@ts-ignore", as "@ts-ignore" will do nothing if the following line is error-free.',
    },
    {
        fixture: "ban-ts-comment--ts-expect-error",
        ruleId: "@typescript-eslint/ban-ts-comment",
        line: 1,
        column: 1,
        message:
            'Include a description after the "@ts-expect-error" directive to explain why the @ts-expect-error is necessary. The description must be 3 characters or longer.',
    },
    {
        fixture: "ban-ts-comment--ts-nocheck",
        ruleId: "@typescript-eslint/ban-ts-comment",
        line: 1,
        column: 1,
        message:
            'Do not use "@ts-nocheck" because it alters compilation errors.',
    },
    {
        fixture: "ban-ts-comment--ts-check",
        ruleId: "@typescript-eslint/ban-ts-comment",
        line: 1,
        column: 1,
        message: 'Do not use "@ts-check" because it alters compilation errors.',
    },
    {
        fixture: "require-description",
        ruleId: "@eslint-community/eslint-comments/require-description",
        line: 2,
        column: 0,
        message:
            "Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.",
    },
    {
        fixture: "no-unlimited-disable",
        ruleId: "@eslint-community/eslint-comments/no-unlimited-disable",
        line: 2,
        column: 0,
        message:
            "Unexpected unlimited 'eslint-disable-next-line' comment. Specify some rule names to disable.",
    },
    {
        fixture: "report-unused-disable-directives",
        ruleId: null,
        line: 2,
        column: 5,
        message:
            "Unused eslint-disable directive (no problems were reported from '@typescript-eslint/consistent-type-assertions').",
    },
    {
        fixture: "no-restricted-syntax--computed-call",
        ruleId: "no-restricted-syntax",
        line: 2,
        column: 5,
        message:
            "Computed call target is unresolvable. Use a Map/record of named functions and call the looked-up value explicitly.",
    },
    {
        fixture: "no-restricted-syntax--dynamic-import",
        ruleId: "no-restricted-syntax",
        line: 2,
        column: 12,
        message: "Dynamic import() is unresolvable. Use a static import.",
    },
    {
        fixture: "no-restricted-syntax--barrel",
        ruleId: "no-restricted-syntax",
        line: 1,
        column: 1,
        message:
            "Barrel re-exports hide real dependency edges and cause cycles. Import from the defining file.",
    },
    {
        fixture: "no-restricted-syntax--reexport",
        ruleId: "no-restricted-syntax",
        line: 1,
        column: 1,
        message:
            "Re-exports hide real dependency edges. Import from the defining file.",
    },
    {
        fixture: "no-restricted-syntax--reflect",
        ruleId: "no-restricted-syntax",
        line: 2,
        column: 12,
        message:
            "Reflect enables indirect calls the graph cannot follow. Call the function directly.",
    },
    {
        fixture: "no-eval",
        ruleId: "no-eval",
        line: 2,
        column: 12,
        message: "`eval` can be harmful.",
    },
    {
        fixture: "no-new-func",
        ruleId: "no-new-func",
        line: 1,
        column: 21,
        message: "The Function constructor is eval.",
    },
    {
        fixture: "switch-exhaustiveness-check",
        ruleId: "@typescript-eslint/switch-exhaustiveness-check",
        line: 3,
        column: 13,
        message: 'Switch is not exhaustive. Cases not matched: "b"',
    },
    {
        fixture: "explicit-function-return-type",
        ruleId: "@typescript-eslint/explicit-function-return-type",
        line: 1,
        column: 8,
        message: "Missing return type on function.",
    },
    {
        fixture: "no-foreign-mutation--param",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 2,
        column: 5,
        message: `Mutating \`xs\`: 'xs' is a parameter, so it belongs to the caller. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--alias",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 3,
        column: 5,
        message: `Mutating \`alias\`: 'alias' may alias memory this function did not create. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--module-state",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 4,
        column: 5,
        message: `Mutating \`cache\`: 'cache' is module-level state. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--member-assign",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 2,
        column: 5,
        message: `Mutating \`counter.count\`: 'counter' is a parameter, so it belongs to the caller. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--loop-element",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 3,
        column: 9,
        message: `Mutating \`task.done\`: 'task' may alias memory this function did not create. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--object-assign",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 2,
        column: 5,
        message: `Mutating \`options\`: 'options' is a parameter, so it belongs to the caller. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--this",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 5,
        column: 9,
        message: `Mutating \`this.count\`: 'this' state belongs to the class instance. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--global",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 2,
        column: 5,
        message: `Mutating \`process.env["MODE"]\`: 'process' is a global. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--import",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 4,
        column: 5,
        message: `Mutating \`env["MODE"]\`: 'env' is imported. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--destructured",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 3,
        column: 5,
        message: `Mutating \`xs\`: 'xs' is destructured out of another value. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--call",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 7,
        column: 5,
        message: `Mutating \`out\`: 'out' may alias memory this function did not create. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--delete",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 2,
        column: 5,
        message: `Mutating \`options.retries\`: 'options' is a parameter, so it belongs to the caller. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--update",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 2,
        column: 5,
        message: `Mutating \`counter.count\`: 'counter' is a parameter, so it belongs to the caller. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--set-add",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 2,
        column: 5,
        message: `Mutating \`seen\`: 'seen' is a parameter, so it belongs to the caller. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--untraceable",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 6,
        column: 5,
        message: `Mutating \`cache().n\`: its origin cannot be traced. ${COPY}`,
    },
    {
        fixture: "no-foreign-mutation--fake-clone",
        ruleId: "mycoscope/no-foreign-mutation",
        line: 4,
        column: 5,
        message: `Mutating \`copy\`: 'copy' may alias memory this function did not create. ${COPY}`,
    },
    {
        fixture: "no-let",
        ruleId: "functional/no-let",
        line: 1,
        column: 8,
        message: "Unexpected let, use const instead.",
    },
];

// Fixtures that must lint clean: the allowed paths.
const CLEAN = [
    "clean",
    "disable-with-reason",
    "no-foreign-mutation--ok",
    "prefer-immutable-types",
    "prefer-immutable-types--depth",
];

// Fixtures live outside tsconfig's `include`, so type-aware rules need them registered
// as default-project files. Kept here so the real config stays free of test plumbing.
const eslint = new ESLint({
    cwd: process.cwd(),
    ignore: false, // the real config ignores fixtures, this should not
    overrideConfig: {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: [`${FIXTURES}/*.ts`],
                    maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 100,
                },
                tsconfigRootDir: process.cwd(),
            },
        },
    },
});

async function lint(fixture: string): Promise<ESLint.LintResult["messages"]> {
    const [result] = await eslint.lintFiles([`${FIXTURES}/${fixture}.ts`]);
    assert.ok(result !== undefined, `no lint result for ${fixture}`);
    return result.messages;
}

for (const { fixture, ruleId, line, column, message } of cases) {
    const label = ruleId ?? "an unused-directive error";
    void test(`${fixture} is reported as ${label}`, async () => {
        const found = (await lint(fixture))
            .filter((m) => m.ruleId === ruleId)
            .map((m) => ({
                ruleId: m.ruleId,
                severity: m.severity,
                line: m.line,
                column: m.column,
                message: m.message,
            }));
        assert.deepEqual(found, [
            { ruleId, severity: 2, line, column, message },
        ]);
    });
}

for (const fixture of CLEAN) {
    void test(`${fixture} produces no messages`, async () => {
        assert.deepEqual(await lint(fixture), []);
    });
}

// Keeps fixture, rule and test lined up: no orphan files, no missing files, names match rules.
void test("every fixture has a test, and is named after its rule", async () => {
    const onDisk = (await readdir(FIXTURES)).map((f) => f.replace(/\.ts$/, ""));
    const tested = [...cases.map((c) => c.fixture), ...CLEAN];
    assert.deepEqual([...onDisk].sort(), [...tested].sort());
    for (const { fixture, ruleId } of cases) {
        const rule = ruleId?.split("/").at(-1);
        if (rule === undefined) continue;
        assert.ok(
            fixture === rule || fixture.startsWith(`${rule}--`),
            `${fixture} should be named ${rule} or ${rule}--<variant>`,
        );
    }
});
