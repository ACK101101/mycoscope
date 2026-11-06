import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { createProject } from "./project.ts";

void test("incremental fixture programs match cold diagnostics after additions, removals and edits", () => {
    const root = mkdtempSync(join(tmpdir(), "mycoscope-program-cache-"));
    const options: ts.CompilerOptions = {
        strict: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.NodeNext,
        types: [],
        skipLibCheck: true,
    };
    const project = createProject(root, "main.ts", options);
    const frames: readonly Readonly<Record<string, string>>[] = [
        {
            "main.ts":
                'import { value } from "./value.js"; const n: number = value;',
            "value.ts": 'export const value = "wrong";',
        },
        {
            "main.ts":
                'import { value } from "./value.js"; const n: number = value;',
        },
        {
            "main.ts":
                'import { value } from "./value.js"; const n: number = value;',
            "value.ts": "export const value = 1;",
        },
        { "main.ts": "const n: string = 1;" },
        { "main.ts": 'const n: string = "ok";' },
    ];
    try {
        writeFileSync(join(root, "package.json"), '{"type":"module"}');
        for (const frame of frames) {
            for (const file of ["main.ts", "value.ts"])
                rmSync(join(root, file), { force: true });
            for (const [file, content] of Object.entries(frame))
                writeFileSync(join(root, file), content);
            const cold = ts.createProgram([join(root, "main.ts")], options);
            const warm = project.program(frame);
            assert.deepEqual(
                ts.getPreEmitDiagnostics(warm).map((item) => item.code),
                ts.getPreEmitDiagnostics(cold).map((item) => item.code),
            );
        }
        assert.throws(() => project.program({ "../escape.ts": "" }));
        assert.throws(() =>
            project.program({ "main.ts": "", "package.json": "{}" }),
        );
    } finally {
        project.dispose();
        rmSync(root, { recursive: true, force: true });
    }
});
