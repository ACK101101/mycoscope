import type { ExceptionChange } from "./detect-directive-changes.ts";

export const MARKER = "<!-- mycoscope:exceptions -->";

export function renderComment(found: readonly ExceptionChange[]): string {
    if (found.length === 0) {
        return `${MARKER}\n**Exceptions:** no exception directive changes in this PR.`;
    }
    const items = found.map((e) => {
        const reason = e.reason === "" ? "**no reason given**" : e.reason;
        const change =
            e.revision === "base"
                ? "Removed or edited suppression boundary"
                : "Added or edited directive";
        return `- **${change} (${e.revision})** \`${e.file}:${String(e.line)}\` \`${e.directive}\` — ${reason}`;
    });
    return [
        MARKER,
        `**Exceptions:** this PR changes ${String(found.length)} lint/type directive(s). Review each explanation and whether a removed or edited boundary widens suppression scope.`,
        "",
        ...items,
    ].join("\n");
}
