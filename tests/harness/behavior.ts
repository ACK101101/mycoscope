import { isDeepStrictEqual } from "node:util";

// Kept inside the frozen harness: behavior assertions cannot depend on validator code under test.
type Json =
    | null
    | boolean
    | number
    | string
    | readonly Json[]
    | { readonly [key: string]: Json };
function json(value: unknown): value is Json {
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean"
    )
        return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every((item: unknown) => json(item));
    return (
        typeof value === "object" &&
        (Object.getPrototypeOf(value) === Object.prototype ||
            Object.getPrototypeOf(value) === null) &&
        Object.values(value).every((item: unknown) => json(item))
    );
}
class BehaviorAssertion extends Error {
    readonly code = "ERR_ASSERTION";
    readonly redGreen = "mycoscope:behavior:1";
    readonly operator = "deepStrictEqual";
    readonly actual: Json;
    readonly expected: Json;
    constructor(actual: Json, expected: Json, message?: string) {
        super(message ?? "Behavior did not match the frozen expectation.");
        this.actual = actual;
        this.expected = expected;
    }
}
export function assertBehaviorEqual(
    actual: unknown,
    expected: unknown,
    message?: string,
): void {
    if (!json(actual) || !json(expected))
        throw new Error("Behavior assertions require plain JSON observations.");
    if (!isDeepStrictEqual(actual, expected))
        throw new BehaviorAssertion(actual, expected, message);
}
