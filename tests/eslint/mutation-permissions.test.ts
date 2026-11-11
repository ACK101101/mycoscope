import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import {
    createPermissions,
    type Source,
} from "../../eslint-rules/permissions.ts";

const FILE = resolve("tests/snippets/permissions.ts");
const CODE = `
import type { Mut as Write, MutDeep } from "../../src/mutation.js";
type Tree = { child: { n: number } };
type Mut<T> = T;
export declare const unmarked: Tree;
export declare const shallow: Write<Tree>;
export declare const deep: MutDeep<Tree>;
export declare const impostor: Mut<Tree>;
export declare const mixed: Write<Tree> | Tree;
export const alias = deep.child;
export const view: { n: number } = deep.child;
export const fresh = { child: { n: 0 } };
export const borrowed = { child: unmarked.child };
export const spread = { ...unmarked };
export declare const fieldGrant: { readonly child: Write<{ n: number }> };
export declare const deepArray: MutDeep<{ n: number }[]>;
export declare const unmarkedArray: { n: number }[];
export declare const writer: (x: Write<Tree>) => void;
export declare const reader: (x: Tree) => void;
`;
const options: ts.CompilerOptions = {
    module: ts.ModuleKind.NodeNext,
    strict: true,
    skipLibCheck: true,
};
const host = ts.createCompilerHost(options);
const original = host.getSourceFile.bind(host);
const program = ts.createProgram([FILE], options, {
    ...host,
    getSourceFile: (file, ...args) =>
        file === FILE
            ? ts.createSourceFile(file, CODE, ts.ScriptTarget.Latest, true)
            : original(file, ...args),
});
const sourceFile = program.getSourceFile(FILE);
assert.ok(sourceFile !== undefined);
assert.deepEqual(program.getSemanticDiagnostics(sourceFile), []);
const declarations = sourceFile.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
        ? [...statement.declarationList.declarations]
        : [],
);
const permissions = createPermissions(program);

function reference(name: string): Source {
    const declaration = declarations.find(
        (item) => item.name.getText() === name,
    );
    assert.ok(declaration !== undefined && ts.isIdentifier(declaration.name));
    return permissions.source(declaration.name);
}

function initializer(name: string): Source {
    const declaration = declarations.find(
        (item) => item.name.getText() === name,
    );
    assert.ok(declaration?.initializer !== undefined);
    return permissions.source(declaration.initializer);
}

void test("only canonical markers grant shallow or deep permission", () => {
    assert.equal(reference("unmarked").permission, 0);
    assert.equal(reference("shallow").permission, 1);
    assert.equal(reference("deep").permission, 2);
    assert.equal(reference("impostor").permission, 0);
    assert.equal(reference("mixed").permission, 0);
});

void test("deep permission follows an alias but an unmarked annotation drops it", () => {
    assert.equal(reference("alias").permission, 2);
    assert.equal(reference("view").permission, 0);
    assert.equal(permissions.child(reference("deep"), "child")?.permission, 2);
    assert.equal(
        permissions.child(reference("shallow"), "child")?.permission,
        0,
    );
    assert.equal(
        permissions.child(reference("fieldGrant"), "child")?.permission,
        1,
    );
});

void test("a fresh shell can receive shallow permission without authorizing borrowed children", () => {
    assert.equal(
        permissions.permits(initializer("fresh"), reference("deep").type),
        true,
    );
    assert.equal(
        permissions.permits(initializer("borrowed"), reference("shallow").type),
        true,
    );
    assert.equal(
        permissions.permits(initializer("borrowed"), reference("deep").type),
        false,
    );
    assert.equal(
        permissions.permits(initializer("spread"), reference("deep").type),
        false,
    );
    assert.equal(
        permissions.permits(reference("unmarked"), reference("shallow").type),
        false,
    );
});

void test("nested field grants must be supplied even when the container is unmarked", () => {
    assert.equal(
        permissions.permits(
            reference("unmarked"),
            reference("fieldGrant").type,
        ),
        false,
    );
    assert.equal(
        permissions.permits(reference("deep"), reference("fieldGrant").type),
        true,
    );
});

void test("deep collection permission cannot be manufactured from unmarked elements", () => {
    assert.equal(
        permissions.permits(
            reference("unmarkedArray"),
            reference("deepArray").type,
        ),
        false,
    );
    assert.equal(
        permissions.permits(
            reference("deepArray"),
            reference("unmarkedArray").type,
        ),
        true,
    );
});

void test("a writable callback cannot be passed off as a callback accepting unmarked data", () => {
    assert.equal(
        permissions.permits(reference("writer"), reference("reader").type),
        false,
    );
    assert.equal(
        permissions.permits(reference("reader"), reference("writer").type),
        true,
    );
});
