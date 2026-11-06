export type Selection = "unit" | "integration" | "all";
export function selectTests(
    files: readonly string[],
    selection: Selection,
): readonly string[] {
    return files
        .filter(
            (file) =>
                file.startsWith("tests/") &&
                !file.startsWith("tests/fixtures/") &&
                file.endsWith(".test.ts") &&
                (selection === "all" ||
                    file.endsWith(".integration.test.ts") ===
                        (selection === "integration")),
        )
        .toSorted();
}
