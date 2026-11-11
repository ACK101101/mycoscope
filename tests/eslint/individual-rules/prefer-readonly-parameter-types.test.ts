import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/prefer-readonly-parameter-types", [
    {
        name: "mutable array inputs are reported",
        code: "export function f(\ninput: string[]\n): void {}",
        expect: [
            {
                id: "@typescript-eslint/prefer-readonly-parameter-types",
                line: 2,
                column: 1,
                text: "input: string[]",
            },
        ],
    },
    {
        name: "readonly arrays still need readonly elements",
        code: "export function f(\ninput: readonly { n: number }[]\n): void {}",
        expect: [
            {
                id: "@typescript-eslint/prefer-readonly-parameter-types",
                line: 2,
                column: 1,
                text: "input: readonly { n: number }[]",
            },
        ],
    },
    {
        name: "mutable object inputs are reported",
        code: "export function f(\ninput: { n: number }\n): void {}",
        expect: [
            {
                id: "@typescript-eslint/prefer-readonly-parameter-types",
                line: 2,
                column: 1,
                text: "input: { n: number }",
            },
        ],
    },
    {
        name: "shallow readonly objects still need readonly children",
        code: "export function f(\ninput: Readonly<{ child: { n: number } }>\n): void {}",
        expect: [
            {
                id: "@typescript-eslint/prefer-readonly-parameter-types",
                line: 2,
                column: 1,
                text: "input: Readonly<{ child: { n: number } }>",
            },
        ],
    },
    {
        name: "a mutable union member is reported",
        code: "export function f(\ninput: readonly string[] | string[]\n): void {}",
        expect: [
            {
                id: "@typescript-eslint/prefer-readonly-parameter-types",
                line: 2,
                column: 1,
                text: "input: readonly string[] | string[]",
            },
        ],
    },
    {
        name: "mutable tuples are reported",
        code: "export function f(\ninput: [string, number]\n): void {}",
        expect: [
            {
                id: "@typescript-eslint/prefer-readonly-parameter-types",
                line: 2,
                column: 1,
                text: "input: [string, number]",
            },
        ],
    },
    {
        name: "method-based Map mutation is outside this check",
        code: "export function f(\ninput: Map<string, number>\n): void {}",
        expect: [],
    },
    {
        name: "method-based Set mutation is outside this check",
        code: "export function f(\ninput: Set<string>\n): void {}",
        expect: [],
    },
    {
        name: "explicitly typed callbacks use the same input contract",
        code: "export const f = (\ninput: string[]\n): void => {};",
        expect: [
            {
                id: "@typescript-eslint/prefer-readonly-parameter-types",
                line: 2,
                column: 1,
                text: "input: string[]",
            },
        ],
    },
    {
        name: "readonly arrays are accepted",
        code: "export function f(input: readonly string[]): void {}",
        expect: [],
    },
    {
        name: "nested readonly objects are accepted",
        code: "export function f(input: { readonly child: { readonly n: number } }): void {}",
        expect: [],
    },
    {
        name: "readonly tuples are accepted",
        code: "export function f(input: readonly [string, number]): void {}",
        expect: [],
    },
    {
        name: "ReadonlyMap inputs are accepted",
        code: "export function f(input: ReadonlyMap<string, number>): void {}",
        expect: [],
    },
    {
        name: "ReadonlySet inputs are accepted",
        code: "export function f(input: ReadonlySet<string>): void {}",
        expect: [],
    },
    {
        name: "primitives and unknown inputs are accepted",
        code: "export function f(input: string | number | null | unknown): void {}",
        expect: [],
    },
    {
        name: "local builders remain mutable",
        code: "export function f(input: readonly string[]): string[] { const result: string[] = []; for (const value of input) result.push(value); return result; }",
        expect: [],
    },
    {
        name: "inferred library callbacks retain their parameter types",
        code: "export function f(input: readonly string[]): string[] { return input.map(value => value.toUpperCase()); }",
        expect: [],
    },
    {
        name: "type-fest supplies deep readonly input types",
        code: 'import type { ReadonlyDeep } from "type-fest";\nexport function f(input: ReadonlyDeep<{ child: { values: number[] } }>): void {}',
        expect: [],
    },
    {
        name: "an intentional mutating API can declare a reasoned exception",
        code: '// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This API intentionally appends to the caller\'s collection.\nexport function append(input: string[]): void { input.push("a"); }',
        expect: [],
    },
    {
        name: "callable methods are accepted without proving their effects",
        code: "interface Counter { readonly value: number; increment(): void; }\nexport function f(input: Counter): void { input.increment(); }",
        expect: [],
    },
    {
        name: "readonly Date does not prove its methods are harmless",
        code: "export function f(input: Readonly<Date>): void { input.setFullYear(2030); }",
        expect: [],
    },
    {
        name: "readonly property types can still flow into writable aliases",
        code: "export function f(input: { readonly n: number }): void { const alias: { n: number } = input; alias.n++; }",
        expect: [],
    },
]);
