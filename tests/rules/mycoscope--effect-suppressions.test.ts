import { lintExamples } from "../harness/lint.ts";

lintExamples(
    "mycoscope/effect-suppressions",
    "// @effect-diagnostics-next-line effect/floatingEffect:off\nexport const n = 1;",
    "// @effect-diagnostics-next-line effect/floatingEffect:off -- callback owns execution\nexport const n = 1;",
);
