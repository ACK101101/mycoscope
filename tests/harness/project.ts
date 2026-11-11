import { realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import ts from "typescript";

export interface FixtureProject {
    readonly directory: string;
    readonly program: (sources: Readonly<Record<string, string>>) => ts.Program;
    readonly dispose: () => void;
}
// The registry shares parsed documents, not diagnostic outcomes or per-program checkers.
const documents = ts.createDocumentRegistry(
    ts.sys.useCaseSensitiveFileNames,
    process.cwd(),
);

export function createProject(
    root: string,
    entry: string,
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- The TypeScript language service consumes its compiler-option types.
    options: ts.CompilerOptions,
): FixtureProject {
    const directory = realpathSync(root);
    const main = resolve(directory, entry);
    const state: {
        version: number;
        sources: ReadonlyMap<string, string>;
    } = { version: 0, sources: new Map() };
    const virtual = new Set<string>();
    function read(file: string): string | undefined {
        if (state.sources.has(file)) return state.sources.get(file);
        return virtual.has(file) ? undefined : ts.sys.readFile(file);
    }
    const host: ts.LanguageServiceHost = {
        getCompilationSettings: () => options,
        getCurrentDirectory: () => directory,
        getScriptFileNames: () => [main],
        getScriptVersion: (file) =>
            virtual.has(file) ? String(state.version) : "0",
        getScriptSnapshot: (file) => {
            const text = read(file);
            return text === undefined
                ? undefined
                : ts.ScriptSnapshot.fromString(text);
        },
        getProjectVersion: () => String(state.version),
        getDefaultLibFileName: (settings) => ts.getDefaultLibFilePath(settings),
        fileExists: (file) =>
            state.sources.has(file) ||
            (!virtual.has(file) && ts.sys.fileExists(file)),
        readFile: read,
        directoryExists: (path) =>
            ts.sys.directoryExists(path) ||
            [...state.sources.keys()].some((file) =>
                file.startsWith(path + sep),
            ),
        getDirectories: (path) => ts.sys.getDirectories(path),
        realpath: (path) =>
            state.sources.has(path) ? path : (ts.sys.realpath?.(path) ?? path),
        useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    };
    const service = ts.createLanguageService(host, documents);
    return {
        directory,
        program(sources): ts.Program {
            const entries = Object.entries(sources).map(([name, text]) => {
                const file = resolve(directory, name);
                if (
                    relative(directory, file).startsWith("..") ||
                    !file.endsWith(".ts")
                )
                    throw new Error(
                        "Fixture sources must be TypeScript files within their project.",
                    );
                return [file, text] as const;
            });
            const next = new Map(entries);
            if (!next.has(main))
                throw new Error("Fixture is missing its entry source.");
            for (const [file] of entries) virtual.add(file);
            state.sources = next;
            state.version += 1;
            const program = service.getProgram();
            if (program === undefined)
                throw new Error(
                    "Fixture language service returned no program.",
                );
            return program;
        },
        dispose(): void {
            service.dispose();
        },
    };
}
