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
]);

testLintRule("mycoscope/no-foreign-mutation", [
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
]);

testLintRule("mycoscope/no-foreign-mutation", [
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
]);

testLintRule("mycoscope/no-foreign-mutation", [
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
]);

testLintRule("mycoscope/no-foreign-mutation", [
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
]);
