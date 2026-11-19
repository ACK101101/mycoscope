import assert from "node:assert/strict";
import { test } from "node:test";
import {
    publishExceptionReport,
    type GitHubComments,
} from "../../scripts/exceptions/publish-pr-comment.ts";
import {
    MARKER,
    renderComment,
} from "../../scripts/exceptions/render-pr-comment.ts";
import type { ExceptionChange } from "../../scripts/exceptions/detect-directive-changes.ts";

interface Comment {
    readonly id: number;
    readonly path: string;
    readonly line: number | null;
    readonly side: "LEFT" | "RIGHT";
    readonly user?: { readonly login: string } | null;
    readonly in_reply_to_id?: number;
    body?: string;
}

const REPO = { owner: "test", repo: "repo" };
const CHANGE: ExceptionChange = {
    file: "src/a.ts",
    line: 2,
    revision: "head",
    directive: "@ts-expect-error",
    reason: "Vendor type mismatch.",
};

function botComment(
    id: number,
    body: string,
    line: number | null = 2,
): Comment {
    return {
        id,
        path: "src/a.ts",
        line,
        side: "RIGHT",
        user: { login: "github-actions[bot]" },
        body,
    };
}

function githubComments(
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- The fake GitHub API updates the caller's comment store.
    comments: Comment[],
    head = "head",
): { readonly github: GitHubComments; readonly writes: readonly string[] } {
    const writes: string[] = [];
    const assertRepo = (options: Readonly<typeof REPO>): void => {
        assert.equal(options.owner, "test");
        assert.equal(options.repo, "repo");
    };
    const github: GitHubComments = {
        paginate: (route, options) => {
            assert.equal(
                route,
                "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
            );
            assert.deepEqual(options, {
                ...REPO,
                pull_number: 2,
                per_page: 100,
            });
            return Promise.resolve([...comments]);
        },
        rest: {
            pulls: {
                get: (options) => {
                    assert.deepEqual(options, { ...REPO, pull_number: 2 });
                    return Promise.resolve({ data: { head: { sha: head } } });
                },
                createReviewComment: (options) => {
                    assertRepo(options);
                    assert.equal(options.pull_number, 2);
                    assert.equal(options.commit_id, "head");
                    writes.push("create");
                    comments.push({
                        id: Math.max(0, ...comments.map(({ id }) => id)) + 1,
                        path: options.path,
                        line: options.line,
                        side: options.side,
                        user: { login: "github-actions[bot]" },
                        body: options.body,
                    });
                    return Promise.resolve({});
                },
                updateReviewComment: (options) => {
                    assertRepo(options);
                    const comment = comments.find(
                        ({ id }) => id === options.comment_id,
                    );
                    assert.ok(comment !== undefined);
                    writes.push("update");
                    comment.body = options.body;
                    return Promise.resolve({});
                },
                deleteReviewComment: (options) => {
                    assertRepo(options);
                    const index = comments.findIndex(
                        ({ id }) => id === options.comment_id,
                    );
                    assert.notEqual(index, -1);
                    writes.push("delete");
                    comments.splice(index, 1);
                    return Promise.resolve({});
                },
            },
        },
    };
    return { github, writes };
}

void test("creates one inline comment per exception on the correct diff side", async () => {
    const comments: Comment[] = [];
    const { github, writes } = githubComments(comments);
    await publishExceptionReport(github, REPO, 2, "head", [
        CHANGE,
        {
            file: "src/renamed.ts",
            line: 7,
            revision: "base",
            directive: "eslint-enable",
            reason: "End workaround.",
        },
    ]);
    assert.deepEqual(
        comments.map(({ path, line, side }) => ({ path, line, side })),
        [
            { path: "src/a.ts", line: 2, side: "RIGHT" },
            { path: "src/renamed.ts", line: 7, side: "LEFT" },
        ],
    );
    assert.match(comments[0]?.body ?? "", /Vendor type mismatch/);
    assert.match(comments[1]?.body ?? "", /End workaround/);
    await publishExceptionReport(github, REPO, 2, "head", [
        CHANGE,
        {
            file: "src/renamed.ts",
            line: 7,
            revision: "base",
            directive: "eslint-enable",
            reason: "End workaround.",
        },
    ]);
    assert.deepEqual(writes, ["create", "create"]);
});

void test("updates the existing thread when its reason changes", async () => {
    const comments = [botComment(4, renderComment(CHANGE))];
    const { github, writes } = githubComments(comments);
    await publishExceptionReport(github, REPO, 2, "head", [
        { ...CHANGE, reason: "Updated reason." },
    ]);
    assert.equal(comments.length, 1);
    assert.equal(comments[0]?.id, 4);
    assert.match(comments[0].body ?? "", /Updated reason/);
    assert.deepEqual(writes, ["update"]);
});

void test("keeps distinct directives at one location without duplicating them on retry", async () => {
    const comments: Comment[] = [];
    const { github, writes } = githubComments(comments);
    const changes = [CHANGE, { ...CHANGE, directive: "@ts-ignore" }];
    await publishExceptionReport(github, REPO, 2, "head", changes);
    await publishExceptionReport(github, REPO, 2, "head", changes);
    assert.equal(comments.length, 2);
    assert.deepEqual(writes, ["create", "create"]);
});

void test("does not modify unrelated comments, other authors, or replies", async () => {
    const comments: Comment[] = [
        botComment(1, "Unrelated bot comment"),
        { ...botComment(2, MARKER), user: { login: "reviewer" } },
        { ...botComment(3, MARKER), user: null },
        { ...botComment(4, MARKER), in_reply_to_id: 1 },
        {
            id: 5,
            path: "src/a.ts",
            line: 2,
            side: "RIGHT",
            user: { login: "github-actions[bot]" },
        },
    ];
    const before = structuredClone(comments);
    const { github } = githubComments(comments);
    await publishExceptionReport(github, REPO, 2, "head", [CHANGE]);
    assert.deepEqual(comments.slice(0, 5), before);
    assert.equal(comments.length, 6);
});

void test("replaces an outdated anchor and deletes obsolete bot comments", async () => {
    const comments = [botComment(1, MARKER, null), botComment(2, MARKER, 8)];
    const { github, writes } = githubComments(comments);
    await publishExceptionReport(github, REPO, 2, "head", [CHANGE]);
    assert.deepEqual(
        comments.map(({ line }) => line),
        [2],
    );
    assert.deepEqual(writes, ["create", "delete", "delete"]);
});

void test("an empty report removes all managed comments", async () => {
    const comments = [botComment(1, MARKER), botComment(2, "Unrelated")];
    const { github } = githubComments(comments);
    await publishExceptionReport(github, REPO, 2, "head", []);
    assert.deepEqual(comments, [botComment(2, "Unrelated")]);
});

void test("an obsolete workflow run does not publish or remove comments", async () => {
    const comments = [botComment(1, MARKER)];
    const { github, writes } = githubComments(comments, "newer-head");
    await publishExceptionReport(
        {
            ...github,
            paginate: () =>
                assert.fail("An obsolete run must not list comments"),
        },
        REPO,
        2,
        "head",
        [CHANGE],
    );
    assert.deepEqual(writes, []);
    assert.deepEqual(comments, [botComment(1, MARKER)]);
});

void test("a failed lookup prevents all writes", async () => {
    const { github, writes } = githubComments([]);
    const failure = new Error("GitHub lookup failed");
    await assert.rejects(
        publishExceptionReport(
            { ...github, paginate: () => Promise.reject(failure) },
            REPO,
            2,
            "head",
            [CHANGE],
        ),
        failure,
    );
    assert.deepEqual(writes, []);
});

void test("a partial publish can be retried without duplicates or premature cleanup", async () => {
    const comments = [botComment(1, MARKER, 8)];
    const { github, writes } = githubComments(comments);
    const changes = [CHANGE, { ...CHANGE, line: 3 }];
    const failure = new Error("Second create failed");
    let creates = 0;
    const failing: GitHubComments = {
        ...github,
        rest: {
            pulls: {
                ...github.rest.pulls,
                createReviewComment: (options) => {
                    creates += 1;
                    return creates === 2
                        ? Promise.reject(failure)
                        : github.rest.pulls.createReviewComment(options);
                },
            },
        },
    };
    await assert.rejects(
        publishExceptionReport(failing, REPO, 2, "head", changes),
        failure,
    );
    assert.deepEqual(writes, ["create"]);
    await publishExceptionReport(github, REPO, 2, "head", changes);
    assert.deepEqual(
        comments.map(({ line }) => line),
        [2, 3],
    );
    assert.deepEqual(writes, ["create", "create", "delete"]);
});

void test("a failed comment edit prevents cleanup", async () => {
    const comments = [botComment(1, MARKER), botComment(2, MARKER, 8)];
    const { github, writes } = githubComments(comments);
    const failure = new Error("Update failed");
    await assert.rejects(
        publishExceptionReport(
            {
                ...github,
                rest: {
                    pulls: {
                        ...github.rest.pulls,
                        updateReviewComment: () => Promise.reject(failure),
                    },
                },
            },
            REPO,
            2,
            "head",
            [CHANGE],
        ),
        failure,
    );
    assert.deepEqual(writes, []);
    assert.equal(comments.length, 2);
});

void test("a failed deletion is reported and can be retried", async () => {
    const comments = [botComment(1, MARKER, 8)];
    const { github, writes } = githubComments(comments);
    const failure = new Error("Delete failed");
    await assert.rejects(
        publishExceptionReport(
            {
                ...github,
                rest: {
                    pulls: {
                        ...github.rest.pulls,
                        deleteReviewComment: () => Promise.reject(failure),
                    },
                },
            },
            REPO,
            2,
            "head",
            [CHANGE],
        ),
        failure,
    );
    assert.equal(comments.length, 2);
    await publishExceptionReport(github, REPO, 2, "head", [CHANGE]);
    assert.deepEqual(
        comments.map(({ line }) => line),
        [2],
    );
    assert.deepEqual(writes, ["create", "delete"]);
});

void test("a push during publishing prevents cleanup from the obsolete run", async () => {
    const comments = [botComment(1, MARKER, 8)];
    const { github, writes } = githubComments(comments);
    let reads = 0;
    await publishExceptionReport(
        {
            ...github,
            rest: {
                pulls: {
                    ...github.rest.pulls,
                    get: () => {
                        reads += 1;
                        return Promise.resolve({
                            data: {
                                head: {
                                    sha: reads === 1 ? "head" : "newer-head",
                                },
                            },
                        });
                    },
                },
            },
        },
        REPO,
        2,
        "head",
        [CHANGE],
    );
    assert.deepEqual(writes, ["create"]);
    assert.equal(comments.length, 2);
});
