import assert from "node:assert/strict";
import { test } from "node:test";
import { findExceptionChanges } from "../../scripts/exceptions/detect-directive-changes.ts";
import { runEffectDiagnostics } from "../harness/effect-adapter.ts";

const MARKER = "@effect-" + "diagnostics";

// Characterize the installed CLI: reporting depends on its raw-text override grammar.
for (const example of [
    {
        name: "a section override embedded in prose",
        code: `// note: ${MARKER} effect/floatingEffect:off`,
        reported: [`${MARKER} effect/floatingEffect:off`],
        severities: [],
        status: 0,
    },
    {
        name: "a section override in a string literal",
        code: `export const text = "${MARKER} effect/floatingEffect:off";`,
        reported: [`${MARKER} effect/floatingEffect:off`],
        severities: [],
        status: 0,
    },
    {
        name: "a section override in a template literal",
        code: `export const text = \`${MARKER} floatingEffect:off\`;`,
        reported: [`${MARKER} floatingEffect:off`],
        severities: [],
        status: 0,
    },
    {
        name: "a next-line override in a leading comment",
        code: `// ${MARKER}-next-line effect/floatingEffect:off`,
        reported: [`${MARKER}-next-line effect/floatingEffect:off`],
        severities: [],
        status: 0,
    },
    {
        name: "a next-line marker in data that reporting conservatively includes",
        code: `export const text = "${MARKER}-next-line effect/floatingEffect:off";`,
        reported: [`${MARKER}-next-line effect/floatingEffect:off`],
        severities: ["error"],
        status: 1,
    },
    {
        name: "an override continued onto the next line",
        code: `/* ${MARKER}\nfloatingEffect:off */`,
        reported: [`${MARKER} floatingEffect:off`],
        severities: [],
        status: 0,
    },
    {
        name: "multiple diagnostic settings after one marker",
        code: `/** ${MARKER} floatingEffect:off missingEffectContext:off */`,
        reported: [`${MARKER} floatingEffect:off missingEffectContext:off`],
        severities: [],
        status: 0,
    },
    {
        name: "a wildcard override",
        code: `// ${MARKER} *:off`,
        reported: [`${MARKER} *:off`],
        severities: [],
        status: 0,
    },
    {
        name: "an error override restoring a disabled diagnostic",
        code: `// ${MARKER} *:off\n// ${MARKER} floatingEffect:error`,
        reported: [`${MARKER} *:off`, `${MARKER} floatingEffect:error`],
        severities: ["error"],
        status: 1,
    },
    {
        name: "a warning override",
        code: `// ${MARKER} floatingEffect:warning`,
        reported: [`${MARKER} floatingEffect:warning`],
        severities: ["warning"],
        status: 1,
    },
    {
        name: "a message override",
        code: `// ${MARKER} floatingEffect:message`,
        reported: [`${MARKER} floatingEffect:message`],
        severities: ["message"],
        status: 0,
    },
    {
        name: "a suggestion override normalized to a message by the CLI",
        code: `// ${MARKER} floatingEffect:suggestion`,
        reported: [`${MARKER} floatingEffect:suggestion`],
        severities: ["message"],
        status: 0,
    },
    {
        name: "a skip-file override inside data, including earlier diagnostics",
        code: `Effect.succeed(0);\nexport const text = "${MARKER} floatingEffect:skip-file";`,
        reported: [`${MARKER} floatingEffect:skip-file`],
        severities: [],
        status: 0,
    },
    {
        name: "a tab separating the marker and setting",
        code: `// ${MARKER}\tfloatingEffect:off`,
        reported: [`${MARKER} floatingEffect:off`],
        severities: [],
        status: 0,
    },
    {
        name: "a severity prefix without a trailing word boundary",
        code: `// ${MARKER} floatingEffect:officer`,
        reported: [`${MARKER} floatingEffect:off`],
        severities: [],
        status: 0,
    },
    {
        name: "two spaces that prevent a setting from matching",
        code: `// ${MARKER}  floatingEffect:off`,
        reported: [],
        severities: ["error"],
        status: 1,
    },
    {
        name: "an uppercase severity that does not match",
        code: `// ${MARKER} floatingEffect:OFF`,
        reported: [],
        severities: ["error"],
        status: 1,
    },
    {
        name: "a marker without diagnostic settings",
        code: `// ${MARKER}`,
        reported: [],
        severities: ["error"],
        status: 1,
    },
]) {
    void test(`Effect override grammar: ${example.name}`, async () => {
        const source = `import { Effect } from "effect";\n${example.code}\nEffect.succeed(1);`;
        const diff = `+++ b/src/a.ts\n@@ -0,0 +1,${String(source.split("\n").length)} @@\n${source
            .split("\n")
            .map((line) => `+${line}`)
            .join("\n")}`;

        assert.deepEqual(
            findExceptionChanges(diff, () => source).map(
                ({ directive }) => directive,
            ),
            example.reported,
        );

        const result = await runEffectDiagnostics(source);
        assert.equal(result.status, example.status);
        assert.deepEqual(
            result.diagnostics.map(({ name, severity }) => ({
                name,
                severity,
            })),
            example.severities.map((severity) => ({
                name: "floatingEffect",
                severity,
            })),
        );
    });
}
