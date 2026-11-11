import assert from "node:assert/strict";
import ts from "typescript";

interface ExceptionDirective {
    readonly file: string;
    readonly line: number;
    readonly directive: string;
    readonly reason: string;
}

export type SourceRevision = "base" | "head";

export type ExceptionChange = ExceptionDirective &
    (
        | { readonly revision: "head" }
        | { readonly revision: "base"; readonly directive: "eslint-enable" }
    );

const ESLINT_DIRECTIVE =
    /^\s*(eslint-disable(?:-next-line|-line)?|eslint-enable|eslint)(?=\s|$)([\s\S]*)$/;
const TS_LINE_DIRECTIVE =
    /^\/?\s*(@ts-expect-error|@ts-ignore|@ts-nocheck(?=\s|:|$))(.*)$/;
const TS_BLOCK_DIRECTIVE =
    /^\s*(?:\/|\*)*\s*(@ts-expect-error|@ts-ignore)(.*)$/;
const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const SCANNED = /\.(?:tsx?|mts|cts)$/;

function diffFilePath(header: string): string {
    const path = header.slice(4).split("\t")[0] ?? "";
    const decoded: unknown = path.startsWith('"') ? JSON.parse(path) : path;
    assert.ok(typeof decoded === "string");
    return decoded.replace(/^[ab]\//, "");
}

function changedLinesByRevision(
    diff: string,
): Readonly<Record<SourceRevision, ReadonlyMap<string, ReadonlySet<number>>>> {
    const files = {
        base: new Map<string, Set<number>>(),
        head: new Map<string, Set<number>>(),
    };
    let baseFile = "";
    let headFile = "";
    let baseLine: number | undefined;
    let headLine: number | undefined;
    const recordLine = (
        revision: SourceRevision,
        file: string,
        line: number,
    ): void => {
        const lines = files[revision].get(file) ?? new Set<number>();
        lines.add(line);
        files[revision].set(file, lines);
    };
    for (const raw of diff.split("\n")) {
        const hunk = HUNK.exec(raw);
        if (raw.startsWith("diff --git ")) {
            baseFile = "";
            headFile = "";
            baseLine = undefined;
            headLine = undefined;
        } else if (headLine === undefined && raw.startsWith("--- ")) {
            baseFile = diffFilePath(raw);
        } else if (headLine === undefined && raw.startsWith("+++ ")) {
            headFile = diffFilePath(raw);
            if (baseFile === "") baseFile = headFile;
        } else if (hunk !== null) {
            baseLine = Number(hunk[1]);
            headLine = Number(hunk[2]);
        } else if (
            baseLine !== undefined &&
            headLine !== undefined &&
            SCANNED.test(headFile)
        ) {
            // A deleted file cannot leave a wider suppression scope behind.
            if (raw.startsWith("+")) {
                recordLine("head", headFile, headLine);
                headLine += 1;
            } else if (raw.startsWith("-")) {
                recordLine("base", baseFile, baseLine);
                baseLine += 1;
            } else if (raw.startsWith(" ")) {
                baseLine += 1;
                headLine += 1;
            }
        }
    }
    return files;
}

function sourceComments(
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- TypeScript traversal APIs consume compiler-owned SourceFile objects.
    source: ts.SourceFile,
): readonly ts.CommentRange[] {
    const comments = new Map<number, ts.CommentRange>();
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        false,
        source.languageVariant,
        source.text,
    );
    const visit = (node: ts.Node): void => {
        // Scan only trivia before parser tokens. Literal contents and JSX text are not comments.
        if (ts.isJSDoc(node) || node.kind === ts.SyntaxKind.JsxText) return;
        if (ts.isToken(node)) {
            scanner.resetTokenState(node.getFullStart());
            const start = node.getStart(source);
            while (scanner.getTokenEnd() < start) {
                const kind = scanner.scan();
                if (
                    kind === ts.SyntaxKind.SingleLineCommentTrivia ||
                    kind === ts.SyntaxKind.MultiLineCommentTrivia
                ) {
                    const pos = scanner.getTokenStart();
                    comments.set(pos, {
                        kind,
                        pos,
                        end: scanner.getTokenEnd(),
                    });
                }
            }
        } else {
            for (const child of node.getChildren(source)) visit(child);
        }
    };
    visit(source);
    return [...comments.values()].sort((a, b) => a.pos - b.pos);
}

function commentException(
    file: string,
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- TypeScript traversal APIs consume compiler-owned SourceFile objects.
    source: ts.SourceFile,
    comment: Readonly<ts.CommentRange>,
): ExceptionDirective | null {
    const block = comment.kind === ts.SyntaxKind.MultiLineCommentTrivia;
    const text = source.text.slice(
        comment.pos + 2,
        comment.end - (block ? 2 : 0),
    );
    const eslint = ESLINT_DIRECTIVE.exec(text);
    // TypeScript reads ignore/expect-error from the last line of a block comment.
    const lastLine = text.split(/\r\n|[\r\n\u2028\u2029]/u).at(-1) ?? "";
    const lastLineStart = text.length - lastLine.length;
    const hit =
        eslint ??
        (block
            ? TS_BLOCK_DIRECTIVE.exec(lastLine)
            : TS_LINE_DIRECTIVE.exec(text));
    const directive = hit?.[1];
    if (directive === undefined) return null;
    if (
        eslint !== null &&
        !block &&
        directive !== "eslint-disable-line" &&
        directive !== "eslint-disable-next-line"
    )
        return null;
    const rest = hit?.[2] ?? "";
    const separator = /\s-{2,}\s/u.exec(rest);
    let reason = rest;
    if (eslint !== null) {
        reason =
            separator === null
                ? ""
                : rest.slice(separator.index + separator[0].length);
    }
    const offset = eslint === null && block ? lastLineStart : 0;
    const position =
        comment.pos + 2 + offset + (hit?.[0].indexOf(directive) ?? 0);
    return {
        file,
        line: source.getLineAndCharacterOfPosition(position).line + 1,
        directive,
        reason: reason.trim().replace(/\s+/gu, " "),
    };
}

// Inspect complete files on both sides so edits inside multiline comments retain context.
export function findExceptionChanges(
    diff: string,
    readSource: (file: string, revision: SourceRevision) => string,
): ExceptionChange[] {
    const found: ExceptionChange[] = [];
    const revisions: readonly SourceRevision[] = ["head", "base"];
    const changedLines = changedLinesByRevision(diff);
    for (const revision of revisions) {
        const changedFiles = changedLines[revision];
        for (const [file, lines] of changedFiles) {
            const source = ts.createSourceFile(
                file,
                readSource(file, revision),
                ts.ScriptTarget.Latest,
                true,
            );
            for (const comment of sourceComments(source)) {
                const firstLine =
                    source.getLineAndCharacterOfPosition(comment.pos).line + 1;
                const lastLine =
                    source.getLineAndCharacterOfPosition(comment.end - 1).line +
                    1;
                if (
                    ![...lines].some(
                        (line) => line >= firstLine && line <= lastLine,
                    )
                )
                    continue;
                const exception = commentException(file, source, comment);
                if (exception === null) continue;
                if (revision === "head") found.push({ ...exception, revision });
                else if (exception.directive === "eslint-enable") {
                    found.push({
                        ...exception,
                        revision,
                        directive: "eslint-enable",
                    });
                }
            }
        }
    }
    return found;
}
