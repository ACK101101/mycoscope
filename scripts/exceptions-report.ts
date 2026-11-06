import type { Mut } from "../src/mutation.js";
import { findAddedExceptions, renderComment } from "./exceptions.ts";

// Usage: git diff -U0 <base>...HEAD | tsx scripts/exceptions-report.ts
// Prints the PR comment body; the workflow decides where to post it.
async function readStdin(): Promise<string> {
    const chunks: Mut<string[]> = [];
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) {
        chunks.push(String(chunk));
    }
    return chunks.join("");
}

const diff = await readStdin();
const added = findAddedExceptions(diff);
console.log(renderComment(added));
