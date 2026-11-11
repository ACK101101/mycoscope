import { testLintRule } from "../../harness/lint-adapter.ts";

const IMPORT = 'import type { Mut, MutDeep } from "../../src/mutation.js";\n';

testLintRule("mycoscope/no-foreign-mutation", [
    {
        name: "explicit shallow permission allows a caller-owned field write",
        code:
            IMPORT +
            "export function f(x: Mut<{ n: number }>): void { x.n++; }",
        expect: [],
    },
    {
        name: "deep permission authorizes descendant writes",
        code:
            IMPORT +
            "export function f(x: MutDeep<{ child: { n: number } }>): void { x.child.n++; }",
        expect: [],
    },
    {
        name: "a field can independently grant shallow permission",
        code:
            IMPORT +
            "export function f(x: { readonly child: Mut<{ n: number }> }): void { x.child.n++; }",
        expect: [],
    },
    {
        name: "an alias preserves explicit permission",
        code:
            IMPORT +
            "export function f(x: Mut<{ n: number }>): void { const y = x; y.n++; }",
        expect: [],
    },
    {
        name: "a marked fresh local is writable",
        code:
            IMPORT +
            "export function f(): void { const x: Mut<{ n: number }> = { n: 0 }; x.n++; }",
        expect: [],
    },
    {
        name: "renaming the canonical import preserves its identity",
        code: 'import type { Mut as Write } from "../../src/mutation.js";\nexport function f(x: Write<{ n: number }>): void { x.n++; }',
        expect: [],
    },
    {
        name: "a nested array with explicit permission supports push",
        code:
            IMPORT +
            "export function f(x: { readonly items: Mut<string[]> }): void { x.items.push('a'); }",
        expect: [],
    },
    {
        name: "shallow permission does not authorize descendants",
        code:
            IMPORT +
            "export function f(x: Mut<{ child: { n: number } }>): void {\nx.child.n++;\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 3,
                column: 1,
                text: "x.child.n++",
            },
        ],
    },
    {
        name: "unmarked fresh locals are readonly references",
        code: "export function f(): void {\nconst x = { n: 0 };\nx.n++;\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 3,
                column: 1,
                text: "x.n++",
            },
        ],
    },
    {
        name: "an impostor named Mut grants nothing",
        code: "type Mut<T> = T;\nexport function f(x: Mut<{ n: number }>): void {\nx.n++;\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 3,
                column: 1,
                text: "x.n++",
            },
        ],
    },
    {
        name: "readonly Date does not authorize an internal state mutation",
        code: "export function f(x: Readonly<Date>): void {\nx.setFullYear(2030);\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 2,
                column: 1,
                text: "x.setFullYear(2030)",
            },
        ],
    },
    {
        name: "aliasing Object.assign does not hide its write",
        code: "export function f(x: { readonly n: number }): void {\nconst assign = Object.assign;\nassign(x, { n: 1 });\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 3,
                column: 1,
                text: "assign(x, { n: 1 })",
            },
        ],
    },
    {
        name: "a union with an unmarked branch grants no permission",
        code:
            IMPORT +
            "export function f(x: Mut<{ n: number }> | { n: number }): void {\nx.n++;\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 3,
                column: 1,
                text: "x.n++",
            },
        ],
    },
    {
        name: "an alias of a deep descendant preserves its permission",
        code:
            IMPORT +
            "export function f(x: MutDeep<{ child: { n: number } }>): void { const child = x.child; child.n++; }",
        expect: [],
    },
    {
        name: "destructuring preserves deep descendant permissions",
        code:
            IMPORT +
            "export function f(x: MutDeep<{ child: { n: number } }>): void { const { child } = x; child.n++; }",
        expect: [],
    },
    {
        name: "iteration preserves deep element permissions",
        code:
            IMPORT +
            "export function f(xs: MutDeep<{ n: number }[]>): void { for (const x of xs) { x.n++; } }",
        expect: [],
    },
    {
        name: "deep permissions propagate through builtin collection reads",
        code:
            IMPORT +
            "export function f(x: MutDeep<Map<string, { n: number }>>): void { const item = x.get('a'); if (item !== undefined) item.n++; }",
        expect: [],
    },
    {
        name: "a user interface named Map is not a builtin mutator",
        code: "interface Map { set: (n: number) => void; }\nexport function f(x: Map): void { x.set(1); }",
        expect: [],
    },
    {
        name: "call cannot hide a builtin receiver mutation",
        code: "export function f(xs: number[]): void {\nArray.prototype.push.call(xs, 1);\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 2,
                column: 1,
                text: "Array.prototype.push.call(xs, 1)",
            },
        ],
    },
    {
        name: "Reflect.set requires mutation permission",
        code: "export function f(x: { n: number }): void {\nReflect.set(x, 'n', 1);\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 2,
                column: 1,
                text: "Reflect.set(x, 'n', 1)",
            },
        ],
    },
    {
        name: "array destructuring preserves deep element permission",
        code:
            IMPORT +
            "export function f(xs: MutDeep<{ n: number }[]>): void { const [x] = xs; if (x !== undefined) x.n++; }",
        expect: [],
    },
    {
        name: "apply cannot hide a builtin receiver mutation",
        code: "export function f(xs: number[]): void {\nArray.prototype.push.apply(xs, [1]);\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 2,
                column: 1,
                text: "Array.prototype.push.apply(xs, [1])",
            },
        ],
    },
    {
        name: "binding a builtin mutator is rejected even with an authorized receiver",
        code:
            IMPORT +
            "export function f(xs: Mut<number[]>): void {\nxs.push.bind(xs);\n}",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                line: 3,
                column: 1,
                text: "xs.push.bind(xs)",
                message:
                    "Call builtin mutators with an explicit receiver instead of binding them.",
            },
        ],
    },
    {
        name: "unmarked array parameters cannot be mutated",
        code: "export function add(xs: string[], x: string): void {\n    xs.push(x);\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                message: "Mutation of `xs` requires Mut or MutDeep permission.",
                line: 2,
                column: 5,
                text: "xs.push(x)",
            },
        ],
    },
    {
        name: "unmarked aliases do not acquire write permission",
        code: "export function add(xs: string[], x: string): void {\n    const alias = xs;\n    alias.push(x);\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 3,
                column: 5,
                text: "alias.push(x)",
            },
        ],
    },
    {
        name: "module-level collections require mutation permission",
        code: "const cache = new Map<string, number>();\n\nexport function put(key: string, value: number): void {\n    cache.set(key, value);\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 4,
                column: 5,
                text: "cache.set(key, value)",
            },
        ],
    },
    {
        name: "compound property assignments require mutation permission",
        code: "export function bump(counter: { count: number }): void {\n    counter.count += 1;\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: "counter.count += 1",
            },
        ],
    },
    {
        name: "unmarked iteration elements cannot be mutated",
        code: "export function finish(tasks: { done: boolean }[]): void {\n    for (const task of tasks) {\n        task.done = true;\n    }\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 3,
                column: 9,
                text: "task.done = true",
            },
        ],
    },
    {
        name: "Object.assign cannot mutate an unmarked target",
        code: "export function configure(options: { retries: number }): void {\n    Object.assign(options, { retries: 3 });\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: "Object.assign(options, { retries: 3 })",
            },
        ],
    },
    {
        name: "instance methods need permission to mutate this",
        code: "export class Counter {\n    count = 0;\n\n    bump(): void {\n        this.count += 1;\n    }\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 5,
                column: 9,
                text: "this.count += 1",
            },
        ],
    },
    {
        name: "global objects do not supply mutation permission",
        code: 'export function setMode(): void {\n    process.env["MODE"] = "x";\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: 'process.env["MODE"] = "x"',
            },
        ],
    },
    {
        name: "imported objects do not supply mutation permission",
        code: 'import { env } from "node:process";\n\nexport function setMode(): void {\n    env["MODE"] = "x";\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 4,
                column: 5,
                text: 'env["MODE"] = "x"',
            },
        ],
    },
    {
        name: "destructuring unmarked data does not supply permission",
        code: 'export function add(holder: { xs: string[] }): void {\n    const { xs } = holder;\n    xs.push("x");\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 3,
                column: 5,
                text: 'xs.push("x")',
            },
        ],
    },
    {
        name: "a factory return does not implicitly grant mutation permission",
        code: 'function makeList(): string[] {\n    return [];\n}\n\nexport function add(): void {\n    const out = makeList();\n    out.push("x");\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 7,
                column: 5,
                text: 'out.push("x")',
            },
        ],
    },
    {
        name: "deleting a property requires mutation permission",
        code: "export function drop(options: { retries?: number }): void {\n    delete options.retries;\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: "delete options.retries",
            },
        ],
    },
    {
        name: "incrementing a property requires mutation permission",
        code: "export function bump(counter: { count: number }): void {\n    counter.count++;\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: "counter.count++",
            },
        ],
    },
    {
        name: "Set.add requires mutation permission",
        code: 'export function add(seen: Set<string>): void {\n    seen.add("x");\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 2,
                column: 5,
                text: 'seen.add("x")',
            },
        ],
    },
    {
        name: "a property on an unmarked call result cannot be mutated",
        code: "function cache(): { n: number } {\n    return { n: 1 };\n}\n\nexport function reset(): void {\n    cache().n = 0;\n}\n",
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 6,
                column: 5,
                text: "cache().n = 0",
            },
        ],
    },
    {
        name: "a function named structuredClone does not grant permission",
        code: 'export function add(xs: readonly string[]): string[] {\n    const structuredClone = (v: readonly string[]): string[] => [...v];\n    const copy = structuredClone(xs);\n    copy.push("x");\n    return copy;\n}\n',
        expect: [
            {
                id: "mycoscope/no-foreign-mutation",
                severity: 2,
                line: 4,
                column: 5,
                text: 'copy.push("x")',
            },
        ],
    },
    {
        name: "append uses authorized mutation or returns a new value",
        code:
            IMPORT +
            "export function append(xs: readonly string[], x: string): string[] {\n    const next: Mut<string[]> = [...xs];\n    next.push(x);\n    return next;\n}",
        expect: [],
    },
    {
        name: "tally uses authorized mutation or returns a new value",
        code:
            IMPORT +
            "export function tally(words: readonly string[]): Map<string, number> {\n    const counts: Mut<Map<string, number>> = new Map<string, number>();\n    for (const word of words) {\n        counts.set(word, (counts.get(word) ?? 0) + 1);\n    }\n    return counts;\n}",
        expect: [],
    },
    {
        name: "counter uses authorized mutation or returns a new value",
        code: "export function counter(): () => number {\n    let total = 0;\n    return () => {\n        total += 1;\n        return total;\n    };\n}",
        expect: [],
    },
    {
        name: "build uses authorized mutation or returns a new value",
        code:
            IMPORT +
            "export function build(name: string): { name: string; tags: string[] } {\n    const out: MutDeep<{ name: string; tags: string[] }> = { name, tags: [] };\n    out.tags.push(name);\n    return out;\n}",
        expect: [],
    },
    {
        name: "sorted uses authorized mutation or returns a new value",
        code:
            IMPORT +
            "export function sorted(xs: readonly number[]): number[] {\n    const out: Mut<number[]> = [...xs];\n    out.sort((a, b) => a - b);\n    return out;\n}",
        expect: [],
    },
    {
        name: "deepCopy uses authorized mutation or returns a new value",
        code:
            IMPORT +
            'export function deepCopy(): { tags: string[] } {\n    const copy: MutDeep<{ tags: string[] }> = structuredClone({ tags: ["a"] });\n    copy.tags.push("x");\n    return copy;\n}',
        expect: [],
    },
    {
        name: "withRetries uses authorized mutation or returns a new value",
        code: "export function withRetries(options: { readonly retries: number }): { retries: number } {\n    return Object.assign({}, options, { retries: 3 });\n}",
        expect: [],
    },
    {
        name: "Counter uses authorized mutation or returns a new value",
        code: "export class Counter {\n    readonly count: number;\n\n    constructor(count: number) {\n        this.count = count;\n    }\n\n    bump(): Counter {\n        return new Counter(this.count + 1);\n    }\n}",
        expect: [],
    },
]);
