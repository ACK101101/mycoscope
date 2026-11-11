import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { MARKER } from "../../scripts/exceptions/render-pr-comment.ts";

interface Comment {
    readonly id: number;
    readonly user: { readonly login: string };
    body: string;
}

const BOT = "github-actions[bot]";

// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- The fake GitHub API updates the caller's comment store.
async function publish(comments: Comment[], body: string): Promise<void> {
    const workflow = readFileSync(".github/workflows/exceptions.yml", "utf8");
    const script = workflow.split("          script: |\n")[1];
    assert.ok(
        script !== undefined,
        "Exception publishing needs an executable workflow script",
    );
    // Execute the workflow's script with an in-memory comment store in place of GitHub.
    const result: unknown = runInNewContext(
        `(async () => {\n${script.replace(/^ {12}/gm, "")}\n})()`,
        {
            require: (name: string) => {
                assert.equal(name, "node:fs");
                return { readFileSync: () => body };
            },
            context: {
                repo: { owner: "test", repo: "repo" },
                issue: { number: 2 },
            },
            github: {
                paginate: () => Promise.resolve(comments),
                rest: {
                    issues: {
                        listComments: () => Promise.resolve({ data: comments }),
                        updateComment: ({
                            comment_id,
                            body: updatedBody,
                        }: {
                            readonly comment_id: number;
                            readonly body: string;
                        }) => {
                            const comment = comments.find(
                                ({ id }) => id === comment_id,
                            );
                            assert.ok(comment !== undefined);
                            comment.body = updatedBody;
                            return Promise.resolve({ data: comment });
                        },
                        createComment: ({
                            body: newBody,
                        }: {
                            readonly body: string;
                        }) => {
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
        },
    );
    await result;
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
