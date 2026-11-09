import ts from "typescript";
import {
    locationFromOffset,
    runCases,
    type TestCase,
    type ActualDiagnostic,
} from "./test-case.ts";

const SNIPPET_PATH = "/case.ts";
// Copy the target and standard libraries from tsconfig.json so snippets can compile.
const COMPILATION_OPTIONS = ["target", "lib"];

function readCompilerOptions(): ts.CompilerOptions {
    const read = ts.readConfigFile("tsconfig.json", (path) =>
        ts.sys.readFile(path),
    );
    if (read.error !== undefined) {
        throw new Error(
            `Failed to read tsconfig.json: TS${String(read.error.code)}: ${ts.flattenDiagnosticMessageText(read.error.messageText, "\n")}`,
        );
    }
    const config: unknown = read.config;
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());
    if (parsed.errors.length > 0) {
        const messages = parsed.errors.map(
            (diagnostic) =>
                `TS${String(diagnostic.code)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
        );
        throw new Error(
            `Failed to parse tsconfig.json: ${messages.join("\n")}`,
        );
    }
    return parsed.options;
}

// Convert the compiler diagnostic fields to the shared assertion format.
function toActualDiagnostic(
    code: string,
    id: string,
    message: string,
    start: number | undefined,
    length: number | undefined,
): ActualDiagnostic {
    if (start === undefined) {
        return { id, line: 0, column: 0, text: "", message };
    }
    return {
        id,
        ...locationFromOffset(code, start),
        text: code.slice(start, start + (length ?? 0)),
        message,
    };
}

// Compile each snippet with the selected option from tsconfig.json.
// requiredOptions adds dependencies, such as strictNullChecks for strictPropertyInitialization.
export function testCompilerOption(
    option: string,
    cases: readonly TestCase[],
    requiredOptions: readonly string[] = [],
): void {
    const configuredOptions = readCompilerOptions();
    const underTest = [option, ...requiredOptions];
    const missing = underTest.filter(
        (name) => configuredOptions[name] === undefined,
    );
    if (missing.length > 0) {
        throw new Error(`${missing.join(", ")} not set in tsconfig.json`);
    }
    const options: ts.CompilerOptions = {
        ...Object.fromEntries(
            [...COMPILATION_OPTIONS, ...underTest].map((name) => [
                name,
                configuredOptions[name],
            ]),
        ),
        noEmit: true,
        types: [],
    };
    const target = options.target ?? ts.ScriptTarget.ESNext;
    const compilerHost = ts.createCompilerHost(options);
    // Reuse parsed library files across cases to avoid parsing them for every snippet.
    const sourceFileCache: Map<string, ts.SourceFile | undefined> = new Map<
        string,
        ts.SourceFile | undefined
    >();
    const cachedSourceFile = (name: string): ts.SourceFile | undefined => {
        if (!sourceFileCache.has(name)) {
            sourceFileCache.set(name, compilerHost.getSourceFile(name, target));
        }
        return sourceFileCache.get(name);
    };

    runCases(option, cases, (code) => {
        const program = ts.createProgram([SNIPPET_PATH], options, {
            ...compilerHost,
            fileExists: (name) =>
                name === SNIPPET_PATH || compilerHost.fileExists(name),
            getSourceFile: (name) =>
                name === SNIPPET_PATH
                    ? ts.createSourceFile(name, code, target)
                    : cachedSourceFile(name),
        });
        const diagnostics: ActualDiagnostic[] = [];
        for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
            diagnostics.push(
                toActualDiagnostic(
                    code,
                    `TS${String(diagnostic.code)}`,
                    ts.flattenDiagnosticMessageText(
                        diagnostic.messageText,
                        "\n",
                    ),
                    diagnostic.file === undefined
                        ? undefined
                        : diagnostic.start,
                    diagnostic.length,
                ),
            );
        }
        return Promise.resolve(diagnostics);
    });
}
