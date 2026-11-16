import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import type { Executable, Policy, SymbolRef } from "./model.js";

function refs(value: unknown): value is readonly SymbolRef[] {
    return (
        Array.isArray(value) &&
        value.every(
            (item: unknown) =>
                typeof item === "object" &&
                item !== null &&
                "module" in item &&
                typeof item.module === "string" &&
                "export" in item &&
                typeof item.export === "string",
        )
    );
}
function executableRefs(value: unknown): value is readonly Executable[] {
    return (
        Array.isArray(value) &&
        value.every(
            (item: unknown) =>
                typeof item === "object" &&
                item !== null &&
                "command" in item &&
                typeof item.command === "string" &&
                "root" in item &&
                refs([item.root]),
        )
    );
}
export interface Project {
    readonly program: ts.Program;
    readonly policy: Policy;
}
// The compiler also reads files internally; its implementation is an external, unverified graph node.
export function readProject(configPath: string): Project {
    const filename = resolve(configPath);
    const value: unknown = JSON.parse(readFileSync(filename, "utf8"));
    if (
        typeof value !== "object" ||
        value === null ||
        !("project" in value) ||
        typeof value.project !== "string" ||
        !("wiringRoots" in value) ||
        !refs(value.wiringRoots) ||
        !("adapters" in value) ||
        !refs(value.adapters)
    )
        throw new Error(
            "Expected project, wiringRoots, and adapters in the Effect policy.",
        );
    const executables: unknown =
        "executables" in value ? value.executables : [];
    if (!executableRefs(executables))
        throw new Error("Expected executable command/root mappings.");
    const rootDirectory = dirname(filename);
    const projectPath = resolve(rootDirectory, value.project);
    const config = ts.readConfigFile(projectPath, (path) =>
        ts.sys.readFile(path),
    );
    if (config.error !== undefined)
        throw new Error(
            ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
        );
    const parsed = ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        dirname(projectPath),
        undefined,
        projectPath,
    );
    if (parsed.errors.length > 0)
        throw new Error(
            parsed.errors
                .map((error) =>
                    ts.flattenDiagnosticMessageText(error.messageText, "\n"),
                )
                .join("\n"),
        );
    if (parsed.fileNames.length === 0)
        throw new Error("The configured project contains no source files.");
    return {
        program: ts.createProgram(parsed.fileNames, parsed.options),
        policy: {
            executables,
            rootDirectory,
            wiringRoots: value.wiringRoots,
            adapters: value.adapters,
        },
    };
}
