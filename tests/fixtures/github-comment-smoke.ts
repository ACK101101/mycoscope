import { Effect } from "effect";

/* eslint-disable no-debugger -- Smoke test section. */
debugger;

// @effect-diagnostics effect/floatingEffect:off -- Smoke test section.
export const work = Effect.succeed(1);

// eslint-disable-next-line no-debugger
debugger;

// @ts-expect-error: Smoke test expected mismatch.
export const expectedMismatch: number = "smoke";

// @ts-ignore
export const ignoredMismatch: number = "smoke";

/* eslint no-debugger: "off" -- Smoke test inline configuration. */
debugger;

// @effect-diagnostics-next-line effect/floatingEffect:off -- Smoke test callback owner.
Effect.succeed(2);

export const embeddedOverride =
    "@effect-diagnostics effect/floatingEffect:warning -- Smoke test data override.";

export const multilineOverride = `@effect-diagnostics
*:off -- Smoke test multiline override.`;

export const ordinaryData = "// eslint-disable-next-line no-debugger";
