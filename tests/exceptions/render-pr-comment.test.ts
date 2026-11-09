import assert from "node:assert/strict";
import { test } from "node:test";
import { renderComment } from "../../scripts/exceptions/render-pr-comment.ts";

void test("comment labels revisions, identifies locations and flags missing reasons", () => {
    const body = renderComment([
        {
            revision: "head",
            file: "src/a.ts",
            line: 1,
            directive: "@ts-expect-error",
            reason: "",
        },
        {
            revision: "base",
            file: "src/a.ts",
            line: 3,
            directive: "eslint-enable",
            reason: "end workaround",
        },
    ]);
    assert.match(body, /mycoscope:exceptions/);
    assert.match(body, /no reason given/);
    assert.match(body, /Removed or edited suppression boundary/);
    assert.match(body, /base/);
    assert.match(body, /src\/a.ts:3/);
});

void test("comment says none when nothing changed", () => {
    assert.match(renderComment([]), /no exception directive changes/);
});
