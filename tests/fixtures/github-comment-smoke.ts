import { Effect } from "effect";

/* eslint-disable no-debugger -- Smoke test section. */
debugger;
/* eslint-enable no-debugger -- End ESLint smoke section. */

// @effect-diagnostics effect/floatingEffect:off -- Smoke test section.
// @effect-diagnostics effect/floatingEffect:error -- End Effect smoke section.
export const work = Effect.succeed(1);
