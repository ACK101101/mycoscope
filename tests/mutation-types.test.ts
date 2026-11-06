import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const FILE = resolve("tests/snippets/mutation-types.ts");
const IMPORT =
    'import type { Mut, MutDeep } from "../../src/mutation.js";\nexport type MarkerTypes = [Mut<object>, MutDeep<object>];\n';

function diagnostics(code: string): readonly number[] {
    const parsed = ts.getParsedCommandLineOfConfigFile(
        "tsconfig.json",
        {},
        {
            ...ts.sys,
            onUnRecoverableConfigFileDiagnostic: (diagnostic): never => {
                throw new Error(
                    ts.flattenDiagnosticMessageText(
                        diagnostic.messageText,
                        "\n",
                    ),
                );
            },
        },
    );
    assert.ok(parsed !== undefined);
    const host = ts.createCompilerHost(parsed.options);
    const original = host.getSourceFile.bind(host);
    const program = ts.createProgram([FILE], parsed.options, {
        ...host,
        getSourceFile: (
            file,
            languageVersion,
            onError,
            shouldCreateNewSourceFile,
        ) =>
            file === FILE
                ? ts.createSourceFile(file, IMPORT + code, languageVersion)
                : original(
                      file,
                      languageVersion,
                      onError,
                      shouldCreateNewSourceFile,
                  ),
    });
    return ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) => diagnostic.code);
}

void test("Mut removes direct readonly while preserving readonly descendants", () => {
    assert.deepEqual(
        diagnostics(
            "export function f(x: Mut<{ readonly child: { readonly n: number } }>): void { x.child = { n: 1 }; x.child.n++; }",
        ),
        [2540],
    );
});

void test("MutDeep removes readonly recursively including nested arrays", () => {
    assert.deepEqual(
        diagnostics(
            "export function f(x: MutDeep<{ readonly children: readonly { readonly n: number }[] }>): void { x.children.push({ n: 1 }); const child = x.children[0]; if (child !== undefined) child.n++; }",
        ),
        [],
    );
});

void test("mutation markers are restricted to reference types", () => {
    assert.deepEqual(
        diagnostics(
            "export type Invalid = Mut<number>; export type AlsoInvalid = MutDeep<string>;",
        ),
        [2344, 2344],
    );
});

void test("permission markers emit no runtime code", () => {
    const source = readFileSync("src/mutation.ts", "utf8");
    const emitted = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext },
    });
    assert.equal(emitted.outputText.trim(), "export {};");
});
