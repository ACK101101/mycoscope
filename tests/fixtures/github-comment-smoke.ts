// @ts-nocheck: Smoke test file-level directive after second push.
import { Effect } from "effect";

/* eslint-disable no-debugger -- Smoke test section. */
debugger;

// @effect-diagnostics effect/floatingEffect:off -- Smoke test section.
export const work = Effect.succeed(1);

// eslint-disable-next-line no-debugger
debugger;

// @ts-expect-error: Updated smoke reason after second push.
export const expectedMismatch: number = "smoke";

/* eslint no-debugger: "off" -- Smoke test inline configuration. */
debugger;

// @effect-diagnostics-next-line effect/floatingEffect:off -- Smoke test callback owner.
Effect.succeed(2);

export const multilineOverride = `@effect-diagnostics
*:off -- Smoke test multiline override.`;

export const ordinaryData = "// eslint-disable-next-line no-debugger";

/* @effect-diagnostics
floatingEffect:off -- Updated multiline boundary. */
