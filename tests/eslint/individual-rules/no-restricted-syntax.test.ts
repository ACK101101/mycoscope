import { test } from "node:test";
import { lintSyntaxRestriction } from "../../harness/lint-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

void test("a call with a computed property name is reported", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "CallExpression[callee.type='MemberExpression'][callee.computed=true][callee.property.type!='Literal']",
        "export function f(o: Record<string, () => void>, k: string): void {\n    o[k]?.();\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-restricted-syntax",
            severity: 2,
            line: 2,
            column: 5,
            text: "o[k]?.()",
            message:
                "Computed call target is unresolvable. Use a Map/record of named functions and call the looked-up value explicitly.",
        },
    ]);
});

void test("a call with a literal property is allowed", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "CallExpression[callee.type='MemberExpression'][callee.computed=true][callee.property.type!='Literal']",
        'export function f(o: Record<string, () => void>): void { o["run"]?.(); }',
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("a dynamic import is reported", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "ImportExpression",
        "export async function f(s: string): Promise<unknown> {\n    return import(s);\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-restricted-syntax",
            severity: 2,
            line: 2,
            column: 12,
            text: "import(s)",
            message: "Dynamic import() is unresolvable. Use a static import.",
        },
    ]);
});

void test("a static import is allowed", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "ImportExpression",
        'import { f } from "./clean.ts"; f();',
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("a wildcard re-export is reported", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "ExportAllDeclaration",
        'export * from "./clean.ts";\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-restricted-syntax",
            severity: 2,
            line: 1,
            column: 1,
            text: 'export * from "./clean.ts";',
            message:
                "Barrel re-exports hide real dependency edges and cause cycles. Import from the defining file.",
        },
    ]);
});

void test("a direct import is allowed", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "ExportAllDeclaration",
        'import { f } from "./clean.ts"; f();',
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("a named re-export is reported", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "ExportNamedDeclaration[source]",
        'export { f } from "./clean.ts";\n',
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-restricted-syntax",
            severity: 2,
            line: 1,
            column: 1,
            text: 'export { f } from "./clean.ts";',
            message:
                "Re-exports hide real dependency edges. Import from the defining file.",
        },
    ]);
});

void test("a local export is allowed", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "ExportNamedDeclaration[source]",
        "const f = 1; export { f };",
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("Reflect member access is reported", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "MemberExpression[object.name='Reflect']",
        "export function f(): unknown {\n    return Reflect.ownKeys({});\n}\n",
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "no-restricted-syntax",
            severity: 2,
            line: 2,
            column: 12,
            text: "Reflect.ownKeys",
            message:
                "Reflect enables indirect calls the graph cannot follow. Call the function directly.",
        },
    ]);
});

void test("Object member access is allowed", async () => {
    const diagnostics = await lintSyntaxRestriction(
        "MemberExpression[object.name='Reflect']",
        "export function f(): string[] { return Object.keys({}); }",
    );
    assertDiagnosticsMatch(diagnostics, []);
});
