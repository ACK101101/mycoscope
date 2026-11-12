export const EFFECT_DIAGNOSTIC_CASES = [
    {
        name: "floatingEffect",
        diagnosticNames: ["floatingEffect"],
        message: "neither yielded nor used",
        rejected: "Effect.succeed(1);",
        accepted: "export const value = Effect.succeed(1);",
    },
    {
        name: "missingEffectError",
        // Upstream CLI workaround: version 0.87.5 gives both missing-channel
        // diagnostics code 1 and labels both missingEffectContext. The message
        // below distinguishes missing errors from missing requirements.
        diagnosticNames: ["missingEffectContext"],
        message: "expected Effect errors",
        rejected:
            'export const f = (): Effect.Effect<never> => Effect.fail("oops");',
        accepted:
            'export const f = (): Effect.Effect<never, string, never> => Effect.fail("oops");',
    },
    {
        name: "missingEffectContext",
        diagnosticNames: ["missingEffectContext"],
        message: "missing from the expected Effect context",
        rejected:
            'class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}\nexport const f: Effect.Effect<number> = Effect.gen(function* () { yield* Reader; return 1; });',
        accepted:
            'class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}\nexport const f: Effect.Effect<number, never, Reader> = Effect.gen(function* () { yield* Reader; return 1; });',
    },
    {
        name: "missingLayerContext",
        diagnosticNames: ["missingLayerContext"],
        message: "expected Layer context",
        rejected:
            'class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}\nclass Config extends Context.Service<Config, { path: string }>()("Config") {}\nexport const layer: Layer.Layer<Reader> = Layer.effect(Reader, Effect.gen(function* () { yield* Config; return { read: () => "x" }; }));',
        accepted:
            'class Reader extends Context.Service<Reader, { read: () => string }>()("Reader") {}\nclass Config extends Context.Service<Config, { path: string }>()("Config") {}\nexport const layer: Layer.Layer<Reader, never, Config> = Layer.effect(Reader, Effect.gen(function* () { yield* Config; return { read: () => "x" }; }));',
    },
    {
        name: "anyUnknownInErrorContext",
        diagnosticNames: [
            "anyUnknownInErrorContext",
            "anyUnknownInErrorContext",
        ],
        message: "unknown in the error channel",
        rejected: "export const value = Effect.fail(undefined as unknown);",
        accepted: 'export const value = Effect.fail("known");',
    },
];
