import assert from "node:assert/strict";
import { test } from "node:test";
import { publishExceptionReport } from "../../scripts/exceptions/publish-pr-comment.ts";
import { MARKER } from "../../scripts/exceptions/render-pr-comment.ts";

interface Comment {
    readonly id: number;
    readonly user?: { readonly login: string } | null;
    body?: string;
}

const BOT = "github-actions[bot]";

// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- The fake GitHub API updates the caller's comment store.
async function publish(comments: Comment[], body: string): Promise<void> {
    await publishExceptionReport(
        {
            paginate: (route, options) => {
                assert.equal(
                    route,
                    "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
                );
                assert.deepEqual(options, {
                    owner: "test",
                    repo: "repo",
                    issue_number: 2,
                    per_page: 100,
                });
                return Promise.resolve(comments);
            },
            rest: {
                issues: {
                    updateComment: ({
                        owner,
                        repo,
                        comment_id,
                        body: updatedBody,
                    }) => {
                        assert.deepEqual(
                            { owner, repo },
                            { owner: "test", repo: "repo" },
                        );
                        const comment = comments.find(
                            ({ id }) => id === comment_id,
                        );
                        assert.ok(comment !== undefined);
                        comment.body = updatedBody;
                        return Promise.resolve({ data: comment });
                    },
                    createComment: ({
                        owner,
                        repo,
                        issue_number,
                        body: newBody,
                    }) => {
                        assert.deepEqual(
                            { owner, repo, issue_number },
                            { owner: "test", repo: "repo", issue_number: 2 },
                        );
                        const comment = {
                            id: comments.length + 1,
                            user: { login: BOT },
                            body: newBody,
                        };
                        comments.push(comment);
                        return Promise.resolve({ data: comment });
                    },
                },
            },
        },
        { owner: "test", repo: "repo" },
        2,
        body,
    );
}

void test("updates the marked exception report without overwriting other bot comments", async () => {
    const comments = [
        { id: 1, user: { login: BOT }, body: "Another report" },
        { id: 2, user: { login: "other[bot]" }, body: `${MARKER}\nOther bot` },
        { id: 3, user: { login: BOT }, body: `${MARKER}\nPrevious exceptions` },
        { id: 4, user: { login: BOT }, body: "Latest unrelated report" },
    ];
    await publish(comments, `${MARKER}\nUpdated exceptions`);
    assert.deepEqual(
        comments.map(({ body }) => body),
        [
            "Another report",
            `${MARKER}\nOther bot`,
            `${MARKER}\nUpdated exceptions`,
            "Latest unrelated report",
        ],
    );
});

void test("creates one report when only unrelated comments or other authors' markers exist", async () => {
    const comments = [
        { id: 1, user: { login: BOT }, body: "Another report" },
        {
            id: 2,
            user: { login: "reviewer" },
            body: `${MARKER}\nReviewer text`,
        },
    ];
    await publish(comments, `${MARKER}\nFirst report`);
    await publish(comments, `${MARKER}\nUpdated report`);
    assert.deepEqual(comments, [
        { id: 1, user: { login: BOT }, body: "Another report" },
        {
            id: 2,
            user: { login: "reviewer" },
            body: `${MARKER}\nReviewer text`,
        },
        { id: 3, user: { login: BOT }, body: `${MARKER}\nUpdated report` },
    ]);
});

void test("comments with a deleted author or missing body do not replace the report", async () => {
    const comments: Comment[] = [
        { id: 1, user: null, body: `${MARKER}\nDeleted author` },
        { id: 2, user: { login: BOT } },
    ];
    await publish(comments, `${MARKER}\nNew report`);
    assert.deepEqual(comments, [
        { id: 1, user: null, body: `${MARKER}\nDeleted author` },
        { id: 2, user: { login: BOT } },
        { id: 3, user: { login: BOT }, body: `${MARKER}\nNew report` },
    ]);
});

void test("a comment lookup failure stops publishing", async () => {
    const failure = new Error("GitHub comment lookup failed");
    await assert.rejects(
        publishExceptionReport(
            {
                paginate: () => Promise.reject(failure),
                rest: {
                    issues: {
                        updateComment: () => {
                            assert.fail(
                                "A failed lookup must not update comments",
                            );
                        },
                        createComment: () => {
                            assert.fail(
                                "A failed lookup must not create comments",
                            );
                        },
                    },
                },
            },
            { owner: "test", repo: "repo" },
            2,
            `${MARKER}\nReport`,
        ),
        failure,
    );
});
