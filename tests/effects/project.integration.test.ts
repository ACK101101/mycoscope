import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { analyze } from "../../src/effects/analyze.ts";
import { readProject } from "../../src/effects/project.ts";

function diagnostics(program: ts.Program): readonly unknown[] {
    return ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
        file:
            diagnostic.file === undefined
                ? undefined
                : basename(diagnostic.file.fileName),
        code: diagnostic.code,
        start: diagnostic.start,
        length: diagnostic.length,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    }));
}

void test("project parsing preserves JSDoc diagnostics and Effect construction graphs", () => {
    const directory = mkdtempSync(join(tmpdir(), "mycoscope-project-jsdoc-"));
    try {
        symlinkSync(
            resolve("node_modules"),
            join(directory, "node_modules"),
            "dir",
        );
        writeFileSync(join(directory, "package.json"), '{"type":"module"}');
        writeFileSync(
            join(directory, "tsconfig.json"),
            JSON.stringify({
                compilerOptions: {
                    strict: true,
                    allowJs: true,
                    checkJs: true,
                    noEmit: true,
                    skipLibCheck: true,
                    types: [],
                    module: "NodeNext",
                    target: "ESNext",
                },
                include: ["main.ts", "checked.js"],
            }),
        );
        const policy = join(directory, "mycoscope.effects.json");
        writeFileSync(
            policy,
            JSON.stringify({
                project: "tsconfig.json",
                wiringRoots: [],
                adapters: [],
            }),
        );
        writeFileSync(
            join(directory, "main.ts"),
            [
                'import { Effect } from "effect";',
                "/** An ordinary documentation comment. @deprecated A fixture only. */",
                "export const task: Effect.Effect<number, never, never> = Effect.succeed(1);",
            ].join("\n"),
        );
        writeFileSync(
            join(directory, "checked.js"),
            [
                "/** @typedef {{name: string}} User */",
                "/** @type {User} */",
                "export const user = {name: 1};",
                "/** @param {number} value */",
                "export function format(value) { return value.toFixed(); }",
                'format("wrong");',
                "/** @type {number} */",
                'export const mismatch = "wrong";',
                "/** @type {number} */",
                "export const valid = 1;",
            ].join("\n"),
        );
        const project = readProject(policy);
        const found = ts.getPreEmitDiagnostics(project.program);
        assert.deepEqual(
            found.map((diagnostic) => diagnostic.code).toSorted(),
            [2322, 2322, 2345],
        );
        assert.ok(
            found.every(
                (diagnostic) =>
                    diagnostic.file?.fileName === join(directory, "checked.js"),
            ),
        );
        // An independent default compiler host retains all documentation metadata.
        const reference = ts.createProgram(
            project.program.getRootFileNames(),
            project.program.getCompilerOptions(),
        );
        assert.deepEqual(diagnostics(project.program), diagnostics(reference));
        const actual = analyze(project.program, project.policy);
        const expected = analyze(reference, project.policy);
        assert.ok(
            actual.contracts.some((contract) => contract.file === "main.ts"),
        );
        assert.deepEqual(actual, expected);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
