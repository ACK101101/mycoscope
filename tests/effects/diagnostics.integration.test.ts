import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
    readEffectDiagnosticSeverities,
    runEffectDiagnostics,
} from "../harness/effect-adapter.ts";

const rejectedDiagnostics = new Set<string>();
const acceptedDiagnostics = new Set<string>();

void test("floatingEffect rejects an unused Effect", async () => {
    const result = await runEffectDiagnostics(`
        import { Effect } from "effect";
        Effect.succeed(1);
    `);

    assert.equal(result.status, 1);
    assert.deepEqual(
        result.diagnostics.map(({ name, severity }) => ({ name, severity })),
        [{ name: "floatingEffect", severity: "error" }],
    );
    rejectedDiagnostics.add("floatingEffect");
});

void test("floatingEffect accepts an exported Effect", async () => {
    const result = await runEffectDiagnostics(`
        import { Effect } from "effect";
        export const value = Effect.succeed(1);
    `);

    assert.equal(result.status, 0);
    assert.deepEqual(result.diagnostics, []);
    acceptedDiagnostics.add("floatingEffect");
});

void test("missingEffectError rejects an omitted error type", async () => {
    const result = await runEffectDiagnostics(`
        import { Effect } from "effect";
        export const f = (): Effect.Effect<never> => Effect.fail("oops");
    `);

    assert.equal(result.status, 1);
    // Upstream CLI workaround: version 0.87.5 assigns both missing-channel
    // diagnostics code 1 and labels both missingEffectContext. Check the message
    // to distinguish missing errors from missing requirements.
    assert.deepEqual(
        result.diagnostics.map(({ name, severity }) => ({ name, severity })),
        [{ name: "missingEffectContext", severity: "error" }],
    );
    assert.match(
        result.diagnostics[0]?.message ?? "",
        /expected Effect errors/,
    );
    rejectedDiagnostics.add("missingEffectError");
});

void test("missingEffectError accepts a declared error type", async () => {
    const result = await runEffectDiagnostics(`
        import { Effect } from "effect";
        export const f = (): Effect.Effect<never, string, never> => Effect.fail("oops");
    `);

    assert.equal(result.status, 0);
    assert.deepEqual(result.diagnostics, []);
    acceptedDiagnostics.add("missingEffectError");
});

void test("missingEffectContext rejects an omitted service requirement", async () => {
    const result = await runEffectDiagnostics(`
        import { Context, Effect } from "effect";
        class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}
        export const f: Effect.Effect<number> = Effect.gen(function* () {
            yield* Reader;
            return 1;
        });
    `);

    assert.equal(result.status, 1);
    assert.deepEqual(
        result.diagnostics.map(({ name, severity }) => ({ name, severity })),
        [{ name: "missingEffectContext", severity: "error" }],
    );
    assert.match(
        result.diagnostics[0]?.message ?? "",
        /missing from the expected Effect context/,
    );
    rejectedDiagnostics.add("missingEffectContext");
});

void test("missingEffectContext accepts a declared service requirement", async () => {
    const result = await runEffectDiagnostics(`
        import { Context, Effect } from "effect";
        class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}
        export const f: Effect.Effect<number, never, Reader> = Effect.gen(function* () {
            yield* Reader;
            return 1;
        });
    `);

    assert.equal(result.status, 0);
    assert.deepEqual(result.diagnostics, []);
    acceptedDiagnostics.add("missingEffectContext");
});

void test("missingLayerContext rejects an omitted Layer requirement", async () => {
    const result = await runEffectDiagnostics(`
        import { Context, Effect, Layer } from "effect";
        class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}
        class Config extends Context.Service<Config, { path: string }>()("Config") {}
        export const layer: Layer.Layer<Reader> = Layer.effect(Reader, Effect.gen(function* () {
            yield* Config;
            return { read: () => "x" };
        }));
    `);

    assert.equal(result.status, 1);
    assert.deepEqual(
        result.diagnostics.map(({ name, severity }) => ({ name, severity })),
        [{ name: "missingLayerContext", severity: "error" }],
    );
    rejectedDiagnostics.add("missingLayerContext");
});

void test("missingLayerContext accepts a declared Layer requirement", async () => {
    const result = await runEffectDiagnostics(`
        import { Context, Effect, Layer } from "effect";
        class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}
        class Config extends Context.Service<Config, { path: string }>()("Config") {}
        export const layer: Layer.Layer<Reader, never, Config> = Layer.effect(Reader, Effect.gen(function* () {
            yield* Config;
            return { read: () => "x" };
        }));
    `);

    assert.equal(result.status, 0);
    assert.deepEqual(result.diagnostics, []);
    acceptedDiagnostics.add("missingLayerContext");
});

void test("anyUnknownInErrorContext rejects an unknown error type", async () => {
    const result = await runEffectDiagnostics(`
        import { Effect } from "effect";
        export const value = Effect.fail(undefined as unknown);
    `);

    assert.equal(result.status, 1);
    assert.deepEqual(
        result.diagnostics.map(({ name, severity }) => ({ name, severity })),
        [
            { name: "anyUnknownInErrorContext", severity: "error" },
            { name: "anyUnknownInErrorContext", severity: "error" },
        ],
    );
    rejectedDiagnostics.add("anyUnknownInErrorContext");
});

void test("anyUnknownInErrorContext accepts a known error type", async () => {
    const result = await runEffectDiagnostics(`
        import { Effect } from "effect";
        export const value = Effect.fail("known");
    `);

    assert.equal(result.status, 0);
    assert.deepEqual(result.diagnostics, []);
    acceptedDiagnostics.add("anyUnknownInErrorContext");
});

void test("a reasoned upstream suppression accepts an unused Effect", async () => {
    const result = await runEffectDiagnostics(
        'import { Effect } from "effect";\n' +
            "// @effect-" +
            "diagnostics-next-line effect/floatingEffect:off -- callback owns execution\n" +
            "Effect.succeed(1);",
    );

    assert.equal(result.status, 0);
    assert.deepEqual(result.diagnostics, []);
});

// Check completed cases after all callbacks, including when tests run concurrently.
after(async () => {
    // Native test selection intentionally omits cases. Check coverage on full runs.
    if (
        process.execArgv.some((argument) =>
            /^--test-(?:name-pattern|skip-pattern|only)(?:=|$)/.test(argument),
        )
    )
        return;
    const severities = await readEffectDiagnosticSeverities();
    const enabled = Object.entries(severities)
        .filter(([, severity]) => severity !== "off")
        .map(([name]) => name)
        .toSorted();
    assert.deepEqual(
        [...rejectedDiagnostics].toSorted(),
        enabled,
        "Every enabled Effect diagnostic needs a passing rejection test",
    );
    assert.deepEqual(
        [...acceptedDiagnostics].toSorted(),
        enabled,
        "Every enabled Effect diagnostic needs a passing acceptance test",
    );
});
