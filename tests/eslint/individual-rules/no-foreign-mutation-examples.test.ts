import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("mycoscope/no-foreign-mutation", [
    {
        name: "no-foreign-mutation--param",
        code: "export function add(xs: string[], x: string): void {\n    xs.push(x);\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: "xs.push(x)",
                message:
                    "Mutating `xs`: 'xs' is a parameter, so it belongs to the caller. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--alias",
        code: "export function add(xs: string[], x: string): void {\n    const alias = xs;\n    alias.push(x);\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 3,
                column: 5,
                text: "alias.push(x)",
                message:
                    "Mutating `alias`: 'alias' may alias memory this function did not create. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--module-state",
        code: "const cache = new Map<string, number>();\n\nexport function put(key: string, value: number): void {\n    cache.set(key, value);\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 4,
                column: 5,
                text: "cache.set(key, value)",
                message:
                    "Mutating `cache`: 'cache' is module-level state. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--member-assign",
        code: "export function bump(counter: { count: number }): void {\n    counter.count += 1;\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: "counter.count += 1",
                message:
                    "Mutating `counter.count`: 'counter' is a parameter, so it belongs to the caller. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--loop-element",
        code: "export function finish(tasks: { done: boolean }[]): void {\n    for (const task of tasks) {\n        task.done = true;\n    }\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 3,
                column: 9,
                text: "task.done = true",
                message:
                    "Mutating `task.done`: 'task' may alias memory this function did not create. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--object-assign",
        code: "export function configure(options: { retries: number }): void {\n    Object.assign(options, { retries: 3 });\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: "Object.assign(options, { retries: 3 })",
                message:
                    "Mutating `options`: 'options' is a parameter, so it belongs to the caller. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--this",
        code: "export class Counter {\n    count = 0;\n\n    bump(): void {\n        this.count += 1;\n    }\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 5,
                column: 9,
                text: "this.count += 1",
                message:
                    "Mutating `this.count`: 'this' state belongs to the class instance. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--global",
        code: 'export function setMode(): void {\n    process.env["MODE"] = "x";\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: 'process.env["MODE"] = "x"',
                message:
                    "Mutating `process.env[\"MODE\"]`: 'process' is a global. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--import",
        code: 'import { env } from "node:process";\n\nexport function setMode(): void {\n    env["MODE"] = "x";\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 4,
                column: 5,
                text: 'env["MODE"] = "x"',
                message:
                    "Mutating `env[\"MODE\"]`: 'env' is imported. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--destructured",
        code: 'export function add(holder: { xs: string[] }): void {\n    const { xs } = holder;\n    xs.push("x");\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 3,
                column: 5,
                text: 'xs.push("x")',
                message:
                    "Mutating `xs`: 'xs' is destructured out of another value. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--call",
        code: 'function makeList(): string[] {\n    return [];\n}\n\nexport function add(): void {\n    const out = makeList();\n    out.push("x");\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 7,
                column: 5,
                text: 'out.push("x")',
                message:
                    "Mutating `out`: 'out' may alias memory this function did not create. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--delete",
        code: "export function drop(options: { retries?: number }): void {\n    delete options.retries;\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: "delete options.retries",
                message:
                    "Mutating `options.retries`: 'options' is a parameter, so it belongs to the caller. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--update",
        code: "export function bump(counter: { count: number }): void {\n    counter.count++;\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: "counter.count++",
                message:
                    "Mutating `counter.count`: 'counter' is a parameter, so it belongs to the caller. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--set-add",
        code: 'export function add(seen: Set<string>): void {\n    seen.add("x");\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: 'seen.add("x")',
                message:
                    "Mutating `seen`: 'seen' is a parameter, so it belongs to the caller. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--untraceable",
        code: "function cache(): { n: number } {\n    return { n: 1 };\n}\n\nexport function reset(): void {\n    cache().n = 0;\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 6,
                column: 5,
                text: "cache().n = 0",
                message:
                    "Mutating `cache().n`: its origin cannot be traced. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
            },
        ],
    },
    {
        name: "no-foreign-mutation--fake-clone",
        code: 'export function add(xs: readonly string[]): string[] {\n    const structuredClone = (v: readonly string[]): string[] => [...v];\n    const copy = structuredClone(xs);\n    copy.push("x");\n    return copy;\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 4,
                column: 5,
                text: 'copy.push("x")',
                message:
                    "Mutating `copy`: 'copy' may alias memory this function did not create. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
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
