import { testLintExamples } from "../../harness/lint-adapter.ts";

const MARKER = "@effect-" + "diagnostics";
testLintExamples(
    "mycoscope/effect-suppressions",
    `// ${MARKER}-next-line effect/floatingEffect:off\nexport const n = 1;`,
    `// ${MARKER}-next-line effect/floatingEffect:off -- callback owns execution\nexport const n = 1;`,
);
testLintExamples(
    "mycoscope/effect-suppressions",
    `// note: ${MARKER} effect/floatingEffect:off\nexport const n = 1;`,
    `// note: ${MARKER} effect/floatingEffect:off -- host owns execution\nexport const n = 1;`,
);
testLintExamples(
    "mycoscope/effect-suppressions",
    `/**\n * ${MARKER} effect/floatingEffect:off\n */\nexport const n = 1;`,
    `/**\n * ${MARKER} effect/floatingEffect:off -- host owns execution\n */\nexport const n = 1;`,
);
testLintExamples(
    "mycoscope/effect-suppressions",
    `const text = "${MARKER} effect/floatingEffect:off -- hidden in data";`,
    `const text = "ordinary data";`,
);
