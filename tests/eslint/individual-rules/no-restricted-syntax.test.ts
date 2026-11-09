import { testSyntaxRestriction } from "../../harness/lint-adapter.ts";

testSyntaxRestriction(
    "CallExpression[callee.type='MemberExpression'][callee.computed=true][callee.property.type!='Literal']",
    [
        {
            name: "a call with a computed property name is reported",
            code: "export function f(o: Record<string, () => void>, k: string): void {\n    o[k]?.();\n}\n",
            expect: [
                {
                    id: "no-restricted-syntax",
                    severity: 2,
                    line: 2,
                    column: 5,
                    text: "o[k]?.()",
                    message:
                        "Computed call target is unresolvable. Use a Map/record of named functions and call the looked-up value explicitly.",
                },
            ],
        },
        {
            name: "a call with a literal property is allowed",
            code: 'export function f(o: Record<string, () => void>): void { o["run"]?.(); }',
            expect: [],
        },
    ],
);

testSyntaxRestriction("ImportExpression", [
    {
        name: "a dynamic import is reported",
        code: "export async function f(s: string): Promise<unknown> {\n    return import(s);\n}\n",
        expect: [
            {
                id: "no-restricted-syntax",
                severity: 2,
                line: 2,
                column: 12,
                text: "import(s)",
                message:
                    "Dynamic import() is unresolvable. Use a static import.",
            },
        ],
    },
    {
        name: "a static import is allowed",
        code: 'import { f } from "./clean.ts"; f();',
        expect: [],
    },
]);

testSyntaxRestriction("ExportAllDeclaration", [
    {
        name: "a wildcard re-export is reported",
        code: 'export * from "./clean.ts";\n',
        expect: [
            {
                id: "no-restricted-syntax",
                severity: 2,
                line: 1,
                column: 1,
                text: 'export * from "./clean.ts";',
                message:
                    "Barrel re-exports hide real dependency edges and cause cycles. Import from the defining file.",
            },
        ],
    },
    {
        name: "a direct import is allowed",
        code: 'import { f } from "./clean.ts"; f();',
        expect: [],
    },
]);

testSyntaxRestriction("ExportNamedDeclaration[source]", [
    {
        name: "a named re-export is reported",
        code: 'export { f } from "./clean.ts";\n',
        expect: [
            {
                id: "no-restricted-syntax",
                severity: 2,
                line: 1,
                column: 1,
                text: 'export { f } from "./clean.ts";',
                message:
                    "Re-exports hide real dependency edges. Import from the defining file.",
            },
        ],
    },
    {
        name: "a local export is allowed",
        code: "const f = 1; export { f };",
        expect: [],
    },
]);

testSyntaxRestriction("MemberExpression[object.name='Reflect']", [
    {
        name: "Reflect member access is reported",
        code: "export function f(): unknown {\n    return Reflect.ownKeys({});\n}\n",
        expect: [
            {
                id: "no-restricted-syntax",
                severity: 2,
                line: 2,
                column: 12,
                text: "Reflect.ownKeys",
                message:
                    "Reflect enables indirect calls the graph cannot follow. Call the function directly.",
            },
        ],
    },
    {
        name: "Object member access is allowed",
        code: "export function f(): string[] { return Object.keys({}); }",
        expect: [],
    },
]);
