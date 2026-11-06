import ts from "typescript";
import type { Mut } from "../mutation.js";

// Positions come from parsed syntax. A standalone scan() loop cannot distinguish template
// tails and regex bodies from comments without parser-directed rescanning.
export function comments(file: ts.SourceFile): readonly ts.CommentRange[] {
    const ranges: Mut<Map<number, ts.CommentRange>> = new Map();
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
