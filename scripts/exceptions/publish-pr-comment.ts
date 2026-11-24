import { MARKER, renderComment } from "./render-pr-comment.ts";
import type { ExceptionChange } from "./detect-directive-changes.ts";

interface Repository {
    readonly owner: string;
    readonly repo: string;
}

interface ReviewComment {
    readonly id: number;
    readonly user?: { readonly login: string } | null;
    readonly body?: string;
    readonly path: string;
    readonly line: number | null;
    readonly side: "LEFT" | "RIGHT";
    readonly in_reply_to_id?: number;
}

type PullRequest = Repository & { readonly pull_number: number };
type CommentUpdate = Repository & {
    readonly comment_id: number;
    readonly body: string;
};

export interface GitHubComments {
    readonly paginate: (
        route: "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        options: PullRequest & { readonly per_page: number },
    ) => Promise<readonly ReviewComment[]>;
    readonly rest: {
        readonly pulls: {
            readonly get: (options: PullRequest) => Promise<{
                readonly data: { readonly head: { readonly sha: string } };
            }>;
            readonly createReviewComment: (
                options: PullRequest & {
                    readonly commit_id: string;
                    readonly path: string;
                    readonly line: number;
                    readonly side: "LEFT" | "RIGHT";
                    readonly body: string;
                },
            ) => Promise<unknown>;
            readonly updateReviewComment: (
                options: CommentUpdate,
            ) => Promise<unknown>;
            readonly deleteReviewComment: (
                options: Repository & { readonly comment_id: number },
            ) => Promise<unknown>;
        };
    };
}

export async function publishExceptionReport(
    github: GitHubComments,
    repo: Repository,
    pullNumber: number,
    commitId: string,
    changes: readonly ExceptionChange[],
): Promise<void> {
    const request = { ...repo, pull_number: pullNumber };
    const { data } = await github.rest.pulls.get(request);
    if (data.head.sha !== commitId) return;
    const comments = await github.paginate(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        { ...request, per_page: 100 },
    );
    const remaining = comments.filter(
        (comment) =>
            comment.user?.login === "github-actions[bot]" &&
            comment.body?.startsWith(MARKER) === true &&
            comment.in_reply_to_id === undefined,
    );
    for (const change of changes) {
        const side = change.revision === "head" ? "RIGHT" : "LEFT";
        const body = renderComment(change);
        const index = remaining.findIndex(
            (comment) =>
                comment.path === change.file &&
                comment.line === change.line &&
                comment.side === side,
        );
        const comment =
            index === -1 ? undefined : remaining.splice(index, 1)[0];
        if (comment === undefined) {
            await github.rest.pulls.createReviewComment({
                ...request,
                commit_id: commitId,
                path: change.file,
                line: change.line,
                side,
                body,
            });
        } else if (comment.body !== body) {
            await github.rest.pulls.updateReviewComment({
                ...repo,
                comment_id: comment.id,
                body,
            });
        }
    }
    // Publish current findings before removing stale comments so a failed write can be retried.
    if (remaining.length > 0) {
        const { data: current } = await github.rest.pulls.get(request);
        if (current.head.sha !== commitId) return;
    }
    for (const comment of remaining) {
        await github.rest.pulls.deleteReviewComment({
            ...repo,
            comment_id: comment.id,
        });
    }
}
