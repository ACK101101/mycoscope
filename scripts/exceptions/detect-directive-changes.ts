import assert from "node:assert/strict";
import ts from "typescript";

interface ExceptionDirective {
    readonly line: number;
    readonly directive: string;
    readonly reason: string;
}

export type SourceRevision = "base" | "head";

export type ExceptionChange = ExceptionDirective & {
    readonly file: string;
    // Anchor to a changed line, including when only a continuation line changed.
    readonly line: number;
    readonly revision: SourceRevision;
};

interface ChangedFile {
    readonly sourcePath: string;
    readonly lines: Set<number>;
}

const ESLINT_DIRECTIVE =
    /^\s*(eslint-disable(?:-next-line|-line)?|eslint-enable|eslint)(?=\s|$)([\s\S]*)$/;
const TS_LINE_DIRECTIVE =
    /^\/?\s*(@ts-expect-error|@ts-ignore|@ts-nocheck(?=\s|:|$))(.*)$/;
const TS_BLOCK_DIRECTIVE =
    /^\s*(?:\/|\*)*\s*(@ts-expect-error|@ts-ignore)(.*)$/;
const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const SCANNED = /\.(?:tsx?|mts|cts)$/;
// Upstream scans raw text, including literals. Keep this grammar aligned with the
// installed CLI; effect-overrides.integration.test.ts checks the shared assumptions.
const EFFECT_DIRECTIVE =
    /@effect-diagnostics(?:-next-line)?(?:\s(?:[a-zA-Z0-9/]+|\*):(?:off|warning|error|message|suggestion|skip-file))+/g;

// Git diffs count LF separators; TypeScript also treats CR and Unicode separators as newlines.
function diffLineFromOffset(source: string, offset: number): number {
    return source.slice(0, offset).split("\n").length;
}

function diffFilePath(header: string): string {
    const path = header.slice(4).split("\t")[0] ?? "";
    const decoded: unknown = path.startsWith('"') ? JSON.parse(path) : path;
    assert.ok(typeof decoded === "string");
    return decoded.replace(/^[ab]\//, "");
}

function changedLinesByRevision(
    diff: string,
): Readonly<Record<SourceRevision, ReadonlyMap<string, ChangedFile>>> {
    const files = {
        base: new Map<string, ChangedFile>(),
        head: new Map<string, ChangedFile>(),
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
        const changed = files[revision].get(headFile) ?? {
            sourcePath: file,
            lines: new Set<number>(),
        };
        changed.lines.add(line);
        // GitHub uses the current path for comments on either side of a rename.
        files[revision].set(headFile, changed);
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
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- TypeScript traversal APIs consume compiler-owned SourceFile objects.
    source: ts.SourceFile,
    comment: Readonly<ts.CommentRange>,
): ExceptionDirective | undefined {
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
    if (directive === undefined) return undefined;
    if (
        eslint !== null &&
        !block &&
        directive !== "eslint-disable-line" &&
        directive !== "eslint-disable-next-line"
    )
        return undefined;
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
        line: diffLineFromOffset(source.text, position),
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
        for (const [file, { sourcePath, lines }] of changedFiles) {
            const source = ts.createSourceFile(
                sourcePath,
                readSource(sourcePath, revision),
                ts.ScriptTarget.Latest,
                true,
            );
            for (const comment of sourceComments(source)) {
                const firstLine = diffLineFromOffset(source.text, comment.pos);
                const lastLine = diffLineFromOffset(
                    source.text,
                    comment.end - 1,
                );
                const changedLine = [...lines].find(
                    (changed) => changed >= firstLine && changed <= lastLine,
                );
                if (changedLine === undefined) continue;
                const exception = commentException(source, comment);
                if (exception === undefined) continue;
                const line = lines.has(exception.line)
                    ? exception.line
                    : changedLine;
                if (revision === "head")
                    found.push({ ...exception, file, line, revision });
                else if (exception.directive === "eslint-enable") {
                    found.push({
                        ...exception,
                        file,
                        line,
                        revision,
                        directive: "eslint-enable",
                    });
                }
            }
            // Include both revisions: deleting a restoring override can extend a suppression.
            for (const override of source.text.matchAll(EFFECT_DIRECTIVE)) {
                const firstLine = diffLineFromOffset(
                    source.text,
                    override.index,
                );
                const lastLine = diffLineFromOffset(
                    source.text,
                    override.index + override[0].length - 1,
                );
                const line = [...lines].find(
                    (changed) => changed >= firstLine && changed <= lastLine,
                );
                if (line === undefined) continue;
                found.push({
                    revision,
                    file,
                    line,
                    directive: override[0].replace(/\s+/gu, " "),
                    reason: (
                        source.text
                            .slice(override.index + override[0].length)
                            .split("\n")[0] ?? ""
                    )
                        .split(" -- ")
                        .slice(1)
                        .join(" -- ")
                        .replace(/\*\/\s*$/, "")
                        .trim(),
                });
            }
        }
    }
    return found;
}
