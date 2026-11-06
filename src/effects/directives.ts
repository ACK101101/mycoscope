export interface EffectOverride {
    readonly directive: string;
    readonly index: number;
    readonly length: number;
    readonly rest: string;
}
// Mirrors the effective override grammar in the pinned upstream CLI. Upstream scans raw
// text, including literals; callers must not assume a match is a JavaScript comment.
export function effectOverrides(text: string): readonly EffectOverride[] {
    const pattern =
        /(@effect-diagnostics(?:-next-line)?)((?:\s(?:[a-zA-Z0-9/]+|\*):(?:off|warning|error|message|suggestion|skip-file))+)/g;
    return [...text.matchAll(pattern)].map((match) => ({
        directive: match[1] ?? "",
        index: match.index,
        length: match[0].length,
        rest:
            text.slice(match.index + (match[1]?.length ?? 0)).split("\n")[0] ??
            "",
    }));
}
