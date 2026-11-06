import { effectOverrides } from "../src/effects/directives.js";
import type { Mut } from "../src/mutation.js";
export interface AddedException {
    readonly file: string;
    readonly line: number;
    readonly directive: string;
    readonly reason: string;
}

export const MARKER = "<!-- mycoscope:exceptions -->";

const DIRECTIVE =
    /(?:\/\/|\/\*)\s*(eslint-disable(?:-next-line|-line)?|@mycoscope-exception|@effect-diagnostics(?:-next-line)?|@ts-expect-error|@ts-ignore|@ts-nocheck)\b(.*)$/;
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const SCANNED = /\.tsx?$/;
// Fixtures break rules on purpose; test files quote directives as data.
const SKIPPED = /(^|\/)tests\/fixtures\/|\.test\.tsx?$/;

function reasonOf(directive: string, rest: string): string {
    const text =
        directive.startsWith("eslint") ||
        directive.startsWith("@effect") ||
        directive === "@mycoscope-exception"
            ? rest.split(" -- ").slice(1).join(" -- ")
            : rest;
    return text.replace(/\*\/\s*$/, "").trim();
}

function match(
    file: string,
    line: number,
    added: string,
): AddedException | null {
    if (!SCANNED.test(file) || SKIPPED.test(file)) return null;
    const hit = DIRECTIVE.exec(added);
    const effect = effectOverrides(added)[0];
    const directive = effect?.directive ?? hit?.[1];
    if (directive === undefined) return null;
    return {
        file,
        line,
        directive,
        reason: reasonOf(directive, effect?.rest ?? hit?.[2] ?? ""),
    };
}

// Reads a unified diff (any context size) and returns every suppression directive it adds.
export function findAddedExceptions(diff: string): AddedException[] {
    const found: Mut<AddedException[]> = [];
    let file = "";
    let line = 0;
    for (const raw of diff.split("\n")) {
        const hunk = HUNK.exec(raw);
        if (raw.startsWith("+++ ")) {
            file = raw.slice(4).replace(/^b\//, "");
        } else if (hunk !== null) {
            line = Number(hunk[1]);
        } else if (raw.startsWith("+")) {
            const exception = match(file, line, raw.slice(1));
            if (exception !== null) found.push(exception);
            line += 1;
        } else if (raw.startsWith(" ")) {
            line += 1;
        }
    }
    return found;
}

export function renderComment(found: readonly AddedException[]): string {
    if (found.length === 0) {
        return `${MARKER}\n**Exceptions:** none added in this PR.`;
    }
    const items = found.map((e) => {
        const reason = e.reason === "" ? "**no reason given**" : e.reason;
        return `- \`${e.file}:${String(e.line)}\` \`${e.directive}\` — ${reason}`;
    });
    return [
        MARKER,
        `**Exceptions:** this PR adds ${String(found.length)} lint/type suppression(s). This is a last resort, see if refactoring to a better pattern is possible. If not, check that each is properly justified.:`,
        "",
        ...items,
    ].join("\n");
}
