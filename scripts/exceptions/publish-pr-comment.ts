import { MARKER } from "./render-pr-comment.ts";

interface Repository {
    readonly owner: string;
    readonly repo: string;
}

interface IssueComment {
    readonly id: number;
    readonly user?: { readonly login: string } | null;
    readonly body?: string;
}

interface GitHubComments {
    readonly paginate: (
        route: "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        options: Repository & {
            readonly issue_number: number;
            readonly per_page: number;
        },
    ) => Promise<readonly IssueComment[]>;
    readonly rest: {
        readonly issues: {
            readonly updateComment: (
                options: Repository & {
                    readonly comment_id: number;
                    readonly body: string;
                },
            ) => Promise<unknown>;
            readonly createComment: (
                options: Repository & {
                    readonly issue_number: number;
                    readonly body: string;
                },
            ) => Promise<unknown>;
        };
    };
}

export async function publishExceptionReport(
    github: GitHubComments,
    repo: Repository,
    issueNumber: number,
    body: string,
): Promise<void> {
    const comments = await github.paginate(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
            ...repo,
            issue_number: issueNumber,
            per_page: 100,
        },
    );
    const report = comments.find(
        (comment) =>
            comment.user?.login === "github-actions[bot]" &&
            comment.body?.startsWith(MARKER) === true,
    );
    if (report === undefined) {
        await github.rest.issues.createComment({
            ...repo,
            issue_number: issueNumber,
            body,
        });
    } else {
        await github.rest.issues.updateComment({
            ...repo,
            comment_id: report.id,
            body,
        });
    }
}
