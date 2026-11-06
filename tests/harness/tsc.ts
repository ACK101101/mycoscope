import type { Mut } from "../../src/mutation.js";
import ts from "typescript";
import { locate, runCases, type Case, type Found } from "./case.ts";

const FILE = "/case.ts";
// Not under test: they only make the snippet compile. `types` is empty and `noEmit` is on.
const PLUMBING = ["target", "lib"];

function realOptions(): ts.CompilerOptions {
    const read = ts.readConfigFile("tsconfig.json", (path) =>
        ts.sys.readFile(path),
    );
    if (read.error !== undefined)
        throw new Error(
            ts.flattenDiagnosticMessageText(read.error.messageText, "\n"),
        );
    const config: unknown = read.config;
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());
    if (parsed.errors.length > 0)
        throw new Error(
            parsed.errors
                .map((diagnostic) =>
                    ts.flattenDiagnosticMessageText(
                        diagnostic.messageText,
                        "\n",
                    ),
                )
                .join("\n"),
        );
    return parsed.options;
}

// A diagnostic as a Found. Takes primitives so the TypeScript objects stay in the caller.
function describeDiagnostic(
    code: string,
    id: string,
    message: string,
    start: number | undefined,
    length: number | undefined,
): Found {
    if (start === undefined) {
        return { id, line: 0, column: 0, text: "", message };
    }
    return {
        id,
        ...locate(code, start),
        text: code.slice(start, start + (length ?? 0)),
        message,
    };
}

// Compiles each snippet with one option from the real tsconfig.json, plus `alsoSet` for
// options that only act together (strictPropertyInitialization needs strictNullChecks).
export function tscOption(
    option: string,
    cases: readonly Case[],
    alsoSet: readonly string[] = [],
): void {
    const real = realOptions();
    const underTest = [option, ...alsoSet];
    // Missing options use TypeScript's actual defaults in baseline replays.
    // The diagnostic assertion, rather than setup, must detect the missing enforcement.
    const options: ts.CompilerOptions = {
        ...Object.fromEntries(
            [...PLUMBING, ...underTest].map((name) => [name, real[name]]),
        ),
        noEmit: true,
        types: [],
    };
    const target = options.target ?? ts.ScriptTarget.ESNext;
    const base = ts.createCompilerHost(options);
    // Parsing the lib files dominates the cost of a case; share them between cases.
    const libs: Mut<Map<string, ts.SourceFile | undefined>> = new Map<
        string,
        ts.SourceFile | undefined
    >();
    const lib = (name: string): ts.SourceFile | undefined => {
        if (!libs.has(name)) {
            libs.set(name, base.getSourceFile(name, target));
        }
        return libs.get(name);
    };

    runCases(option, cases, (code) => {
        const program = ts.createProgram([FILE], options, {
            ...base,
            fileExists: (name) => name === FILE || base.fileExists(name),
            getSourceFile: (name) =>
                name === FILE
                    ? ts.createSourceFile(name, code, target)
                    : lib(name),
        });
        const found: Mut<Found[]> = [];
        for (const d of ts.getPreEmitDiagnostics(program)) {
            found.push(
                describeDiagnostic(
                    code,
                    `TS${String(d.code)}`,
                    ts.flattenDiagnosticMessageText(d.messageText, "\n"),
                    d.file === undefined ? undefined : d.start,
                    d.length,
                ),
            );
        }
        return Promise.resolve(found);
    });
}
