import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import type { Policy, SymbolRef } from "./model.js";

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
export interface Project {
    readonly program: ts.Program;
    readonly policy: Policy;
}
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
            rootDirectory,
            wiringRoots: value.wiringRoots,
            adapters: value.adapters,
        },
    };
}
