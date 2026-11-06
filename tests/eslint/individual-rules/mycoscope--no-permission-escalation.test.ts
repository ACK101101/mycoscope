import { testLintRule } from "../../harness/lint-adapter.ts";

const IMPORT = 'import type { Mut, MutDeep } from "../../src/mutation.js";\n';
const RULE = "mycoscope/no-permission-escalation";

testLintRule(RULE, [
    {
        name: "a readonly argument cannot enter a writable parameter",
        code:
            IMPORT +
            "declare function write(x: Mut<{ n: number }>): void;\nexport function f(x: { readonly n: number }): void {\nwrite(x);\n}",
        expect: [{ id: RULE, line: 4, column: 7, text: "x" }],
    },
    {
        name: "an alias of the callee preserves its mutation contract",
        code:
            IMPORT +
            "declare function write(x: Mut<{ n: number }>): void;\nexport function f(x: { readonly n: number }): void {\nconst alias = write;\nalias(x);\n}",
        expect: [{ id: RULE, line: 5, column: 7, text: "x" }],
    },
    {
        name: "a variable annotation cannot manufacture a grant",
        code:
            IMPORT +
            "export function f(x: { readonly n: number }): void {\nconst y: Mut<{ n: number }> = x;\n}",
        expect: [{ id: RULE, line: 3, column: 31, text: "x" }],
    },
    {
        name: "a return annotation cannot manufacture a grant",
        code:
            IMPORT +
            "export function f(x: { readonly n: number }): Mut<{ n: number }> {\nreturn x;\n}",
        expect: [{ id: RULE, line: 3, column: 8, text: "x" }],
    },
    {
        name: "shallow copies cannot grant deep access to borrowed children",
        code:
            IMPORT +
            "export function f(x: { readonly child: { readonly n: number } }): void {\nconst y: MutDeep<{ child: { n: number } }> = { ...x };\n}",
        expect: [{ id: RULE, line: 3, column: 46, text: "{ ...x }" }],
    },
    {
        name: "a shallow grant cannot become a deep grant",
        code:
            IMPORT +
            "export function f(x: Mut<{ child: { n: number } }>): void {\nconst y: MutDeep<{ child: { n: number } }> = x;\n}",
        expect: [{ id: RULE, line: 3, column: 46, text: "x" }],
    },
    {
        name: "nested field grants must also be supplied by the caller",
        code:
            IMPORT +
            "declare function write(x: { readonly child: Mut<{ n: number }> }): void;\nexport function f(x: { readonly child: { readonly n: number } }): void {\nwrite(x);\n}",
        expect: [{ id: RULE, line: 4, column: 7, text: "x" }],
    },
    {
        name: "a mutating function cannot hide behind a readonly callback",
        code:
            IMPORT +
            "declare function write(x: Mut<{ n: number }>): void;\nconst callback: (x: { readonly n: number }) => void = write;",
        expect: [{ id: RULE, line: 3, column: 55, text: "write" }],
    },
    {
        name: "a newly constructed object can receive shallow permission",
        code: IMPORT + "const x: Mut<{ n: number }> = { n: 0 };",
        expect: [],
    },
    {
        name: "a deeply fresh object can receive deep permission",
        code:
            IMPORT +
            "const x: MutDeep<{ child: { n: number } }> = { child: { n: 0 } };",
        expect: [],
    },
    {
        name: "existing grants cross function boundaries",
        code:
            IMPORT +
            "declare function write(x: Mut<{ n: number }>): void;\nexport function f(x: Mut<{ n: number }>): void { write(x); }",
        expect: [],
    },
]);

testLintRule(RULE, [
    {
        name: "deep containers cannot adopt borrowed elements through push",
        code:
            IMPORT +
            "export function f(xs: MutDeep<{ n: number }[]>, x: { readonly n: number }): void {\nxs.push(x);\n}",
        expect: [{ id: RULE, line: 3, column: 9, text: "x" }],
    },
    {
        name: "deep fields cannot adopt borrowed objects through assignment",
        code:
            IMPORT +
            "export function f(xs: MutDeep<{ child: { n: number } }>, x: { readonly n: number }): void {\nxs.child = x;\n}",
        expect: [{ id: RULE, line: 3, column: 12, text: "x" }],
    },
    {
        name: "tuple spread cannot hide a writable later parameter",
        code:
            IMPORT +
            "declare function write(label: string, x: Mut<{ n: number }>): void;\nexport function f(args: readonly [string, { readonly n: number }]): void {\nwrite(...args);\n}",
        expect: [{ id: RULE, line: 4, column: 7, text: "...args" }],
    },
    {
        name: "a writable callback return must supply a writable result",
        code:
            IMPORT +
            "declare const x: { readonly n: number };\nconst f: () => Mut<{ n: number }> = () => x;",
        expect: [{ id: RULE, line: 3, column: 37, text: "() => x" }],
    },
    {
        name: "an async return cannot manufacture a writable result",
        code:
            IMPORT +
            "export async function f(x: { readonly n: number }): Promise<Mut<{ n: number }>> {\nreturn x;\n}",
        expect: [{ id: RULE, line: 3, column: 8, text: "x" }],
    },
]);

testLintRule(RULE, [
    {
        name: "deep containers cannot adopt borrowed children through Object.assign",
        code:
            IMPORT +
            "export function f(x: MutDeep<{ child: { n: number } }>, child: { readonly n: number }): void {\nObject.assign(x, { child });\n}",
        expect: [{ id: RULE, line: 3, column: 18, text: "{ child }" }],
    },
    {
        name: "collection type arguments cannot manufacture field grants",
        code:
            IMPORT +
            "export function f(x: Map<string, { readonly n: number }>): void {\nconst y: Map<string, Mut<{ n: number }>> = x;\n}",
        expect: [{ id: RULE, line: 3, column: 44, text: "x" }],
    },
    {
        name: "promises cannot manufacture writable results",
        code:
            IMPORT +
            "export function f(x: Promise<{ readonly n: number }>): Promise<Mut<{ n: number }>> {\nreturn x;\n}",
        expect: [{ id: RULE, line: 3, column: 8, text: "x" }],
    },
]);

testLintRule(RULE, [
    {
        name: "constructors that return a borrowed object are not fresh allocations",
        code:
            IMPORT +
            "declare const borrowed: { n: number };\nclass C { n = 0; constructor() { return borrowed; } }\nconst x: Mut<C> = new C();",
        expect: [{ id: RULE, line: 4, column: 19, text: "new C()" }],
    },
    {
        name: "a view of a borrowed buffer cannot manufacture mutation permission",
        code:
            IMPORT +
            "export function f(buffer: ArrayBuffer): void {\nconst x: Mut<Uint8Array> = new Uint8Array(buffer);\n}",
        expect: [
            { id: RULE, line: 3, column: 28, text: "new Uint8Array(buffer)" },
        ],
    },
    {
        name: "an empty builtin collection can receive deep permission",
        code:
            IMPORT +
            "const x: MutDeep<Map<string, { n: number }>> = new Map<string, { n: number }>();",
        expect: [],
    },
]);

testLintRule(RULE, [
    {
        name: "reassignment cannot replace a deep alias with a borrowed object",
        code:
            IMPORT +
            "export function f(x: MutDeep<{ child: { n: number } }>, borrowed: { readonly n: number }): void {\nlet child = x.child;\nchild = borrowed;\n}",
        expect: [{ id: RULE, line: 4, column: 9, text: "borrowed" }],
    },
    {
        name: "default parameters must supply their declared permissions",
        code:
            IMPORT +
            "declare const borrowed: { readonly n: number };\nexport function f(x: Mut<{ n: number }> = borrowed): void { console.log(x); }",
        expect: [{ id: RULE, line: 3, column: 43, text: "borrowed" }],
    },
    {
        name: "constructor arguments must supply mutation permissions",
        code:
            IMPORT +
            "class C { constructor(x: Mut<{ n: number }>) { x.n++; } }\nexport function f(x: { readonly n: number }): void {\nnew C(x);\n}",
        expect: [{ id: RULE, line: 4, column: 7, text: "x" }],
    },
    {
        name: "class field annotations cannot manufacture permissions",
        code:
            IMPORT +
            "declare const borrowed: { readonly n: number };\nclass C { field: Mut<{ n: number }> = borrowed; }",
        expect: [{ id: RULE, line: 3, column: 39, text: "borrowed" }],
    },
]);

testLintRule(RULE, [
    {
        name: "string indexes cannot manufacture grants",
        code:
            IMPORT +
            "export function f(x: Record<string, { n: number }>): void {\nconst y: Record<string, Mut<{ n: number }>> = x;\n}",
        expect: [{ id: RULE, line: 3, column: 47, text: "x" }],
    },
    {
        name: "wrapping a mutating callback cannot erase its contract",
        code:
            IMPORT +
            "declare const impl: { run: (x: Mut<{ n: number }>) => void };\nconst api: { run: (x: { n: number }) => void } = impl;",
        expect: [{ id: RULE, line: 3, column: 50, text: "impl" }],
    },
    {
        name: "overload signatures cannot promise unearned writable returns",
        code:
            IMPORT +
            "function f(x: { n: number }): Mut<{ n: number }>;\nfunction f(x: { n: number }): { n: number } {\nreturn x;\n}",
        expect: [{ id: RULE, line: 4, column: 8, text: "x" }],
    },
    {
        name: "every spread element consumed by a rest parameter is checked",
        code:
            IMPORT +
            "declare function write(...xs: Mut<{ n: number }>[]): void;\nexport function f(x: { n: number }): void {\nwrite(...[{ n: 0 }, x]);\n}",
        expect: [{ id: RULE, line: 4, column: 7, text: "...[{ n: 0 }, x]" }],
    },
    {
        name: "computed builtin calls preserve deep storage obligations",
        code:
            IMPORT +
            "export function f(xs: MutDeep<{ n: number }[]>, x: { n: number }): void {\nxs['push'](x);\n}",
        expect: [{ id: RULE, line: 3, column: 12, text: "x" }],
    },
    {
        name: "Object.assign preserves nested grants on shallow targets",
        code:
            IMPORT +
            "export function f(x: Mut<{ child: Mut<{ n: number }> }>, child: { n: number }): void {\nObject.assign(x, { child });\n}",
        expect: [{ id: RULE, line: 3, column: 18, text: "{ child }" }],
    },
]);

testLintRule(RULE, [
    {
        name: "recursive target types still check distinct nested source objects",
        code:
            IMPORT +
            "interface Link { readonly value: Mut<{ n: number }>; readonly next?: Link; }\nexport function f(authorized: Mut<{ n: number }>, borrowed: { n: number }): void {\nconst x: Link = { value: authorized, next: { value: borrowed } };\n}",
        expect: [
            {
                id: RULE,
                line: 4,
                column: 17,
                text: "{ value: authorized, next: { value: borrowed } }",
            },
        ],
    },
]);
