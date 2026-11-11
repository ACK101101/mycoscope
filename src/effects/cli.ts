import ts from "typescript";
import { analyze } from "./analyze.js";
import { readProject } from "./project.js";

export function readArguments(): string {
    return process.argv[2] ?? "mycoscope.effects.json";
}
export function writeResult(result: unknown): void {
    console.log(JSON.stringify(result, null, 2));
}
export function setExitCode(code: number): void {
    process.exitCode = code;
}
export function main(configPath: string): number {
    try {
        const project = readProject(configPath);
        const diagnostics = ts.getPreEmitDiagnostics(project.program);
        if (diagnostics.length > 0) {
            writeResult({
                errors: diagnostics.map((diagnostic) =>
                    ts.flattenDiagnosticMessageText(
                        diagnostic.messageText,
                        "\n",
                    ),
                ),
            });
            return 1;
        }
        const report = analyze(project.program, project.policy);
        writeResult(report);
        return report.issues.length === 0 ? 0 : 1;
    } catch (error: unknown) {
        writeResult({
            error: error instanceof Error ? error.message : String(error),
        });
        return 1;
    }
}
