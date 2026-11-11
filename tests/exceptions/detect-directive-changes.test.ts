import assert from "node:assert/strict";
import { test } from "node:test";
import {
    findExceptionChanges,
    type ExceptionChange,
} from "../../scripts/exceptions/detect-directive-changes.ts";

function addedFile(file: string, source: string): string {
    const lines = source.split("\n");
    return `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -0,0 +1,${String(lines.length)} @@\n${lines.map((line) => `+${line}`).join("\n")}`;
}

function report(source: string, file = "src/a.ts"): ExceptionChange[] {
    return findExceptionChanges(addedFile(file, source), () => source);
}

void test("reports wiring exceptions in comments but not quoted examples", () => {
    const directive = "@mycoscope-" + "exception";
    assert.deepEqual(
        report(`// ${directive} unresolved-wiring -- plugin owns selection`),
        [
            {
                revision: "head",
                file: "src/a.ts",
                line: 1,
                directive,
                reason: "plugin owns selection",
            },
        ],
    );
    assert.deepEqual(
        report(`const text = "// ${directive} unresolved-wiring -- example";`),
        [],
    );
});

void test("reports effective Effect overrides in comments and literals", () => {
    const marker = "@effect-" + "diagnostics";
    for (const source of [
        `// ${marker}-next-line effect/floatingEffect:off -- callback owns execution`,
        `// note: ${marker}-next-line effect/floatingEffect:off -- callback owns execution`,
        `/**\n * ${marker}-next-line effect/floatingEffect:off -- callback owns execution\n */`,
        `const text = "${marker}-next-line effect/floatingEffect:off -- callback owns execution";`,
    ]) {
        const changes = report(source);
        assert.equal(changes.length, 1);
        const change = changes[0];
        assert.ok(change !== undefined);
        assert.equal(change.directive, `${marker}-next-line`);
        assert.match(change.reason, /callback owns execution/);
    }
});

void test("reports an Effect override when only its continuation line changes", () => {
    const marker = "@effect-" + "diagnostics";
    const source = `/* ${marker}\neffect/floatingEffect:off */`;
    const diff =
        "+++ b/src/a.ts\n@@ -2 +2 @@\n-effect/floatingEffect:error */\n+effect/floatingEffect:off */";
    assert.equal(
        findExceptionChanges(diff, () => source)[0]?.directive,
        marker,
    );
});

void test("finds added directives with their source location and reason", () => {
    const source = [
        "const ok = 1;",
        "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendor type is wrong",
        "// @ts-expect-error",
        "/* eslint-disable no-console */",
    ].join("\n");
    assert.deepEqual(report(source), [
        {
            revision: "head",
            file: "src/a.ts",
            line: 2,
            directive: "eslint-disable-next-line",
            reason: "vendor type is wrong",
        },
        {
            revision: "head",
            file: "src/a.ts",
            line: 3,
            directive: "@ts-expect-error",
            reason: "",
        },
        {
            revision: "head",
            file: "src/a.ts",
            line: 4,
            directive: "eslint-disable",
            reason: "",
        },
    ]);
});

void test("finds multiline directives when only a continuation line changes", () => {
    const source =
        "/*\neslint-disable\n  no-debugger -- vendor callback\n*/\ndebugger;";
    const diff =
        "+++ b/src/a.ts\n@@ -3 +3 @@\n-  no-console -- vendor callback\n+  no-debugger -- vendor callback";
    assert.deepEqual(
        findExceptionChanges(diff, () => source),
        [
            {
                revision: "head",
                file: "src/a.ts",
                line: 2,
                directive: "eslint-disable",
                reason: "vendor callback",
            },
        ],
    );
});

void test("includes real suppressions in tests and fixtures", () => {
    for (const file of [
        "tests/example.test.ts",
        "tests/fixtures/example.ts",
        "src/example.mts",
        "src/example.cts",
    ]) {
        assert.deepEqual(
            report("// @ts-ignore: vendor type is wrong\nf();", file),
            [
                {
                    revision: "head",
                    file,
                    line: 1,
                    directive: "@ts-ignore",
                    reason: ": vendor type is wrong",
                },
            ],
        );
    }
});

void test("ignores directive text in strings, template text, regexes, JSX text and ordinary comments", () => {
    const source = [
        'const text = "// eslint-disable-next-line no-debugger -- example";',
        "const template = `/* eslint-disable no-debugger -- example */`;",
        String.raw`const pattern = /\/\/ eslint-disable-next-line/;`,
        "const element = <div>// eslint-disable-next-line no-debugger</div>;",
        "// Example: eslint-disable-next-line no-debugger -- documentation",
    ].join("\n");
    assert.deepEqual(report(source, "src/example.tsx"), []);
});

void test("finds comments inside template expressions and after regex literals", () => {
    const source =
        "const template = `${ /* eslint-disable no-debugger -- vendor callback */ f() }`;\nconst pattern = /x/; // eslint-disable-line no-unused-vars -- example";
    assert.deepEqual(
        report(source).map(({ line, directive }) => ({ line, directive })),
        [
            { line: 1, directive: "eslint-disable" },
            { line: 2, directive: "eslint-disable-line" },
        ],
    );
});

void test("reports inline rule configuration that can disable lint checks", () => {
    assert.deepEqual(
        report('/* eslint no-debugger: "off" -- vendor callback */\ndebugger;'),
        [
            {
                revision: "head",
                file: "src/a.ts",
                line: 1,
                directive: "eslint",
                reason: "vendor callback",
            },
        ],
    );
});

void test("tracks new-side lines across hunks, context and deletions", () => {
    const source =
        "// @ts-expect-error: unchanged\nf();\n// @ts-ignore: vendor type is wrong\ng();\n// eslint-disable-line no-debugger -- vendor callback";
    const diff =
        "+++ b/src/a.ts\n@@ -1,3 +1,4 @@\n // @ts-expect-error: unchanged\n f();\n-old();\n+// @ts-ignore: vendor type is wrong\n+g();\n@@ -8 +5 @@\n-previous();\n+// eslint-disable-line no-debugger -- vendor callback";
    assert.deepEqual(
        findExceptionChanges(diff, () => source).map(({ line }) => line),
        [3, 5],
    );
});

void test("ignores deleted and non-TypeScript files without reading them", () => {
    const diff =
        "+++ /dev/null\n@@ -1 +0,0 @@\n-// @ts-ignore\n" +
        addedFile("README.md", "// @ts-ignore");
    assert.deepEqual(
        findExceptionChanges(diff, () => {
            throw new Error("unexpected source read");
        }),
        [],
    );
});

void test("distinguishes active block directives from unsupported directive-like comments", () => {
    for (const newline of ["\n", "\r\n", "\r"]) {
        const source = `/* preceding explanation${newline} * @ts-expect-error: vendor type is wrong */${newline}f();`;
        assert.deepEqual(report(source), [
            {
                revision: "head",
                file: "src/a.ts",
                line: 2,
                directive: "@ts-expect-error",
                reason: ": vendor type is wrong",
            },
        ]);
    }
    assert.deepEqual(
        report(
            "// eslint-disable no-debugger -- not a supported line directive\n/* @ts-nocheck: not a supported block directive */\nf();",
        ),
        [],
    );
});

void test("added increment expressions cannot be mistaken for diff file headers", () => {
    const source =
        "let x = 0;\n++ x;\n// @ts-ignore: vendor type is wrong\nf();";
    assert.equal(report(source)[0]?.line, 3);
});

void test("a source read failure stops the report instead of claiming no exceptions", () => {
    assert.throws(() => {
        findExceptionChanges(addedFile("src/a.ts", "// @ts-ignore"), () => {
            throw new Error("Cannot read src/a.ts");
        });
    }, /Cannot read src\/a.ts/);
});

void test("recognizes TypeScript's directive prefix even without whitespace before its explanation", () => {
    assert.deepEqual(report("// @ts-ignore_vendor_reason\nf();"), [
        {
            revision: "head",
            file: "src/a.ts",
            line: 1,
            directive: "@ts-ignore",
            reason: "_vendor_reason",
        },
    ]);
    assert.deepEqual(
        report("//// @ts-ignore: not an active directive\nf();"),
        [],
    );
});

const BOUNDARY_BASE = [
    "/* eslint-disable no-debugger -- vendor workaround */",
    "debugger;",
    "/* eslint-enable no-debugger -- end workaround */",
    "debugger;",
].join("\n");
const BOUNDARY_HEAD = BOUNDARY_BASE.split("\n")
    .filter((_, index) => index !== 2)
    .join("\n");

void test("reports a deleted suppression boundary with its base-revision location", () => {
    const diff =
        "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,0 +1,2 @@\n+const a = 1;\n+const b = 2;\n@@ -3 +4,0 @@\n-/* eslint-enable no-debugger -- end workaround */";
    const found = findExceptionChanges(diff, (_, revision) =>
        revision === "base"
            ? BOUNDARY_BASE
            : "const a = 1;\nconst b = 2;\n" + BOUNDARY_HEAD,
    );
    assert.deepEqual(found, [
        {
            revision: "base",
            file: "src/a.ts",
            line: 3,
            directive: "eslint-enable",
            reason: "end workaround",
        },
    ]);
});

void test("detects a removed rule in a multiline suppression boundary", () => {
    const base =
        "/*\neslint-enable\n no-debugger,\n no-console -- end workaround\n*/\nf();";
    const head = "/*\neslint-enable\n no-console -- end workaround\n*/\nf();";
    const diff =
        "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -3 +2,0 @@\n- no-debugger,";
    assert.deepEqual(
        findExceptionChanges(diff, (_, revision) =>
            revision === "base" ? base : head,
        ),
        [
            {
                revision: "base",
                file: "src/a.ts",
                line: 2,
                directive: "eslint-enable",
                reason: "end workaround",
            },
        ],
    );
});

void test("uses the original path when a boundary is removed during a rename", () => {
    const diff =
        "diff --git a/src/old.ts b/src/new.ts\n--- a/src/old.ts\n+++ b/src/new.ts\n@@ -3 +2,0 @@\n-/* eslint-enable no-debugger -- end workaround */";
    const found = findExceptionChanges(diff, (file, revision) => {
        assert.equal(revision, "base");
        assert.equal(file, "src/old.ts");
        return BOUNDARY_BASE;
    });
    assert.deepEqual(found, [
        {
            revision: "base",
            file: "src/old.ts",
            line: 3,
            directive: "eslint-enable",
            reason: "end workaround",
        },
    ]);
});

void test("does not report deleted strings, ordinary comments or suppression openings as boundaries", () => {
    for (const base of [
        'const example = "/* eslint-enable no-debugger -- example */";',
        "// eslint-enable no-debugger -- not an effective directive",
        "/* eslint-disable no-debugger -- vendor workaround */",
    ]) {
        const diff = `--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +0,0 @@\n-${base}`;
        assert.deepEqual(
            findExceptionChanges(diff, () => base),
            [],
        );
    }
});

void test("deleting an entire file does not report its obsolete suppression boundaries", () => {
    const diff =
        "--- a/src/a.ts\n+++ /dev/null\n@@ -1,4 +0,0 @@\n" +
        BOUNDARY_BASE.split("\n")
            .map((line) => `-${line}`)
            .join("\n");
    assert.deepEqual(
        findExceptionChanges(diff, () => {
            throw new Error("Deleted source should not be read");
        }),
        [],
    );
});

void test("moving a suppression boundary reports both its old and new locations", () => {
    const head =
        BOUNDARY_HEAD + "\n/* eslint-enable no-debugger -- end workaround */";
    const diff =
        "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -3,2 +3,2 @@\n-/* eslint-enable no-debugger -- end workaround */\n debugger;\n+/* eslint-enable no-debugger -- end workaround */";
    const found = findExceptionChanges(diff, (_, revision) =>
        revision === "base" ? BOUNDARY_BASE : head,
    );
    assert.deepEqual(
        found.map(({ revision, line, directive }) => ({
            revision,
            line,
            directive,
        })),
        [
            { revision: "head", line: 4, directive: "eslint-enable" },
            { revision: "base", line: 3, directive: "eslint-enable" },
        ],
    );
});
