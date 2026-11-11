import ts from "typescript";

// Positions come from parsed syntax. A standalone scan() loop cannot distinguish template
// tails and regex bodies from comments without parser-directed rescanning.
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
export function comments(file: ts.SourceFile): readonly ts.CommentRange[] {
    const ranges = new Map<number, ts.CommentRange>();
    function visit(node: ts.Node): void {
        const leading = ts.getLeadingCommentRanges(file.text, node.pos) ?? [];
        const trailing = ts.getTrailingCommentRanges(file.text, node.end) ?? [];
        for (const range of [...leading, ...trailing])
            ranges.set(range.pos, range);
        ts.forEachChild(node, visit);
    }
    visit(file);
    return [...ranges.values()];
}
