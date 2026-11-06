export interface Budgets {
    readonly testMs: number;
    readonly suiteMs: number;
}
export interface Timing {
    readonly kind: "test" | "suite";
    readonly name: string;
    readonly durationMs: number;
}
export const DEFAULT_BUDGETS: Budgets = { testMs: 100, suiteMs: 10000 };
export function parseBudgets(value: unknown): Budgets {
    if (
        typeof value !== "object" ||
        value === null ||
        !("testMs" in value) ||
        !("suiteMs" in value) ||
        typeof value.testMs !== "number" ||
        typeof value.suiteMs !== "number" ||
        !Number.isFinite(value.testMs) ||
        !Number.isFinite(value.suiteMs) ||
        value.testMs <= 0 ||
        value.suiteMs <= 0
    )
        throw new Error(
            "Runtime budgets require finite positive testMs and suiteMs values.",
        );
    return { testMs: value.testMs, suiteMs: value.suiteMs };
}
export function budgetWarnings(
    timing: Timing,
    budgets: Budgets,
): readonly string[] {
    const limit = timing.kind === "test" ? budgets.testMs : budgets.suiteMs;
    if (timing.durationMs <= limit) return [];
    const name = timing.name.replaceAll("\r", "\\r").replaceAll("\n", "\\n");
    return [
        `${timing.kind === "test" ? "Test" : "Suite"} ${name} took ${String(Math.round(timing.durationMs))} ms (budget ${String(limit)} ms).`,
    ];
}
