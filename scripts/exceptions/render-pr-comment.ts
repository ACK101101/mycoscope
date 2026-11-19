import type { ExceptionChange } from "./detect-directive-changes.ts";

export const MARKER = "<!-- mycoscope:exceptions -->";

export function renderComment(change: ExceptionChange): string {
    const title =
        change.revision === "base"
            ? "Removed or edited directive"
            : "Exception to review";
    const reason = change.reason === "" ? "**no reason given**" : change.reason;
    const review =
        change.revision === "base"
            ? "Review whether this change widens suppression scope."
            : "Review whether this exception and its explanation are appropriate.";
    return `${MARKER}\n**${title}:** \`${change.directive}\`\n\n**Reason:** ${reason}\n\n${review}`;
}
