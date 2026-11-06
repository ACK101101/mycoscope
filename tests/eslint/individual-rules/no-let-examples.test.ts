import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("functional/no-let", [
    {
        name: "no-let",
        code: "export let count = 0;\n",
        expect: [
            {
                id: "functional/no-let",
                severity: 2,
                line: 1,
                column: 8,
                text: "let count = 0;",
                message: "Unexpected let, use const instead.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--ok is allowed",
        code: 'import type { Mut, MutDeep } from "../../src/mutation.js";\nexport function append(xs: readonly string[], x: string): string[] {\n    const next: Mut<string[]> = [...xs];\n    next.push(x);\n    return next;\n}\n\nexport function tally(words: readonly string[]): Map<string, number> {\n    const counts: Mut<Map<string, number>> = new Map<string, number>();\n    for (const word of words) {\n        counts.set(word, (counts.get(word) ?? 0) + 1);\n    }\n    return counts;\n}\n\nexport function counter(): () => number {\n    let total = 0;\n    return () => {\n        total += 1;\n        return total;\n    };\n}\n\nexport function build(name: string): { name: string; tags: string[] } {\n    const out: MutDeep<{ name: string; tags: string[] }> = { name, tags: [] };\n    out.tags.push(name);\n    return out;\n}\n\nexport function sorted(xs: readonly number[]): number[] {\n    const out: Mut<number[]> = [...xs];\n    out.sort((a, b) => a - b);\n    return out;\n}\n\nexport function deepCopy(): { tags: string[] } {\n    const copy: MutDeep<{ tags: string[] }> = structuredClone({ tags: ["a"] });\n    copy.tags.push("x");\n    return copy;\n}\n\nexport function withRetries(options: { readonly retries: number }): { retries: number } {\n    return Object.assign({}, options, { retries: 3 });\n}\n\nexport class Counter {\n    readonly count: number;\n\n    constructor(count: number) {\n        this.count = count;\n    }\n\n    bump(): Counter {\n        return new Counter(this.count + 1);\n    }\n}\n',
        expect: [],
    },
    {
        name: "prefer-immutable-types is allowed",
        code: "export function total(items: { n: number }[]): number {\n    return items.length;\n}\n",
        expect: [],
    },
    {
        name: "prefer-immutable-types--depth is allowed",
        code: "export function total(items: readonly { n: number }[]): number {\n    return items.length;\n}\n",
        expect: [],
    },
]);
