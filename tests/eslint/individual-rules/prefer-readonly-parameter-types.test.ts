import { test } from "node:test";
import { lintRule } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("mutable array inputs are reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(\ninput: string[]\n): void {}",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/prefer-readonly-parameter-types",
            line: 2,
            column: 1,
            text: "input: string[]",
        },
    ]);
});

void test("readonly arrays still need readonly elements", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(\ninput: readonly { n: number }[]\n): void {}",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/prefer-readonly-parameter-types",
            line: 2,
            column: 1,
            text: "input: readonly { n: number }[]",
        },
    ]);
});

void test("mutable object inputs are reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(\ninput: { n: number }\n): void {}",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/prefer-readonly-parameter-types",
            line: 2,
            column: 1,
            text: "input: { n: number }",
        },
    ]);
});

void test("shallow readonly objects still need readonly children", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(\ninput: Readonly<{ child: { n: number } }>\n): void {}",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/prefer-readonly-parameter-types",
            line: 2,
            column: 1,
            text: "input: Readonly<{ child: { n: number } }>",
        },
    ]);
});

void test("a mutable union member is reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(\ninput: readonly string[] | string[]\n): void {}",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/prefer-readonly-parameter-types",
            line: 2,
            column: 1,
            text: "input: readonly string[] | string[]",
        },
    ]);
});

void test("mutable tuples are reported", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(\ninput: [string, number]\n): void {}",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/prefer-readonly-parameter-types",
            line: 2,
            column: 1,
            text: "input: [string, number]",
        },
    ]);
});

void test("method-based Map mutation is outside this check", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(\ninput: Map<string, number>\n): void {}",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("method-based Set mutation is outside this check", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(\ninput: Set<string>\n): void {}",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("explicitly typed callbacks use the same input contract", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export const f = (\ninput: string[]\n): void => {};",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "@typescript-eslint/prefer-readonly-parameter-types",
            line: 2,
            column: 1,
            text: "input: string[]",
        },
    ]);
});

void test("readonly arrays are accepted", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: readonly string[]): void {}",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("nested readonly objects are accepted", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: { readonly child: { readonly n: number } }): void {}",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("readonly tuples are accepted", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: readonly [string, number]): void {}",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("ReadonlyMap inputs are accepted", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: ReadonlyMap<string, number>): void {}",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("ReadonlySet inputs are accepted", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: ReadonlySet<string>): void {}",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("primitives and unknown inputs are accepted", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: string | number | null | unknown): void {}",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("local builders remain mutable", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: readonly string[]): string[] { const result: string[] = []; for (const value of input) result.push(value); return result; }",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("inferred library callbacks retain their parameter types", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: readonly string[]): string[] { return input.map(value => value.toUpperCase()); }",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("type-fest supplies deep readonly input types", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        'import type { ReadonlyDeep } from "type-fest";\nexport function f(input: ReadonlyDeep<{ child: { values: number[] } }>): void {}',
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("an intentional mutating API can declare a reasoned exception", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        '// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This API intentionally appends to the caller\'s collection.\nexport function append(input: string[]): void { input.push("a"); }',
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("callable methods are accepted without proving their effects", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "interface Counter { readonly value: number; increment(): void; }\nexport function f(input: Counter): void { input.increment(); }",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("readonly Date does not prove its methods are harmless", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: Readonly<Date>): void { input.setFullYear(2030); }",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("readonly property types can still flow into writable aliases", async () => {
    const diagnostics = await lintRule(
        "@typescript-eslint/prefer-readonly-parameter-types",
        "export function f(input: { readonly n: number }): void { const alias: { n: number } = input; alias.n++; }",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
