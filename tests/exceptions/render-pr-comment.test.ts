import assert from "node:assert/strict";
import { test } from "node:test";
import { renderComment } from "../../scripts/exceptions/render-pr-comment.ts";

void test("an inline comment identifies the exception and flags a missing reason", () => {
    const body = renderComment({
        revision: "head",
        file: "src/a.ts",
        line: 1,
        directive: "@ts-expect-error",
        reason: "",
    });
    assert.match(body, /mycoscope:exceptions/);
    assert.match(body, /Exception to review/);
    assert.match(body, /@ts-expect-error/);
    assert.match(body, /no reason given/);
});

void test("a deleted directive asks reviewers to check whether suppression scope widens", () => {
    const body = renderComment({
        revision: "base",
        file: "src/a.ts",
        line: 3,
        directive: "eslint-enable",
        reason: "End workaround.",
    });
    assert.match(body, /Removed or edited directive/);
    assert.match(body, /eslint-enable/);
    assert.match(body, /End workaround/);
    assert.match(body, /widens suppression scope/);
});
