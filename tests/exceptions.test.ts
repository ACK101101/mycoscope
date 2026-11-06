import assert from "node:assert/strict";
import { test } from "node:test";
import { findAddedExceptions, renderComment } from "../scripts/exceptions.ts";

const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -10,0 +11,3 @@",
    "+const ok = 1;",
    "+// eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendor type is wrong",
    "+// @ts-expect-error",
    "@@ -40 +42 @@",
    "-old",
    "+  /* eslint-disable no-console */",
    "diff --git a/tests/fixtures/x.ts b/tests/fixtures/x.ts",
    "+++ b/tests/fixtures/x.ts",
    "@@ -0,0 +1 @@",
    "+// @ts-ignore",
    "diff --git a/README.md b/README.md",
    "+++ b/README.md",
    "@@ -0,0 +1 @@",
    "+// eslint-disable-next-line in docs",
].join("\n");

void test("finds added directives with file, line and reason", () => {
    assert.deepEqual(findAddedExceptions(diff), [
        {
            file: "src/a.ts",
            line: 12,
            directive: "eslint-disable-next-line",
            reason: "vendor type is wrong",
        },
        {
            file: "src/a.ts",
            line: 13,
            directive: "@ts-expect-error",
            reason: "",
        },
        { file: "src/a.ts", line: 42, directive: "eslint-disable", reason: "" },
    ]);
});

void test("ignores fixtures and non-TypeScript files", () => {
    const files = findAddedExceptions(diff).map((e) => e.file);
    assert.deepEqual([...new Set(files)], ["src/a.ts"]);
});

void test("comment flags a missing reason and carries the marker", () => {
    const body = renderComment(findAddedExceptions(diff));
    assert.match(body, /mycoscope:exceptions/);
    assert.match(body, /no reason given/);
    assert.match(body, /vendor type is wrong/);
});

void test("comment says none when nothing was added", () => {
    assert.match(renderComment([]), /none added/);
});
