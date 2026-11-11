import { createProject } from "../harness/project.ts";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, after } from "node:test";
import ts from "typescript";
import { analyze, RULES } from "../../src/effects/analyze.js";
import type { Findings, Policy } from "../../src/effects/model.js";

const IMPORT = 'import { Effect, Layer, Context, Clock } from "effect";\n';
const SERVICE =
    'class Reader extends Context.Service<Reader, { read: () => Effect.Effect<string, never, never> }>()("Reader") {}\n';

const directory = mkdtempSync(join(tmpdir(), "mycoscope-wiring-"));
symlinkSync(resolve("node_modules"), join(directory, "node_modules"), "dir");
writeFileSync(join(directory, "package.json"), '{"type":"module"}');
const project = createProject(directory, "main.ts", {
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    skipLibCheck: true,
});
after(() => {
    project.dispose();
    rmSync(directory, { recursive: true, force: true });
});

function check(
    code: string,
    options: Partial<Pick<Policy, "wiringRoots" | "adapters">> = {},
    extra: Readonly<Record<string, string>> = {},
): Findings {
    const program = project.program({ "main.ts": IMPORT + code, ...extra });
    return analyze(program, {
        rootDirectory: project.directory,
        wiringRoots: [],
        adapters: [],
        ...options,
    });
}

const root = { module: "main.ts", export: "main" };
const adapter = { module: "main.ts", export: "read" };
const CASES = [
    {
        rule: "effect-contract",
        bad: "export const task = Effect.succeed(1);",
        good: "export const task: Effect.Effect<number, never, never> = Effect.succeed(1);",
    },
    {
        rule: "wiring-boundary",
        bad: "export function f(): Promise<number> { return Effect.runPromise(Effect.succeed(1)); }",
        good: "export const f: Effect.Effect<number, never, never> = Effect.succeed(1);",
    },
    {
        rule: "implicit-capability",
        bad: "export const task: Effect.Effect<number, never, never> = Clock.currentTimeMillis;",
        good: "export const task: Effect.Effect<number, never, never> = Effect.succeed(1);",
    },
    {
        rule: "invalid-policy",
        bad: "export const n = 1;",
        good: "export function main(): number { return 1; }",
        options: { wiringRoots: [root] },
    },
    {
        rule: "exception-reason",
        bad: "// @mycoscope-exception implicit-capability\nexport const task: Effect.Effect<number, never, never> = Clock.currentTimeMillis;",
        good: "// @mycoscope-exception implicit-capability -- tracked by host clock adapter\nexport const task: Effect.Effect<number, never, never> = Clock.currentTimeMillis;",
    },
];
for (const example of CASES) {
    void test(`${example.rule} rejects its violation and accepts its control`, () => {
        assert.ok(
            check(example.bad, example.options).issues.some(
                (issue) => issue.rule === example.rule,
            ),
        );
        assert.deepEqual(check(example.good, example.options).issues, []);
    });
}
void test("every visibility rule has a behavior case", () => {
    assert.deepEqual(
        Object.keys(RULES).toSorted(),
        CASES.map((example) => example.rule).toSorted(),
    );
});

void test("renamed and curried provisioning retains symbol identity", () => {
    const report = check(
        "const give = Effect.provide; export const f: Effect.Effect<number, never, never> = Effect.succeed(1).pipe(give(Layer.empty));",
    );
    assert.ok(report.issues.some((issue) => issue.rule === "wiring-boundary"));
});
void test("a same-spelled application function is not Effect provisioning", () => {
    assert.deepEqual(
        check(
            "function provide(n: number): number { return n; } export const n = provide(1);",
        ).issues,
        [],
    );
});
void test("a named layer can be composed outside a wiring root", () => {
    assert.deepEqual(
        check(
            "export const layer: Layer.Layer<never, never, never> = Layer.provide(Layer.empty, Layer.empty);",
        ).issues,
        [],
    );
});
void test("adapters are symbol scoped and aliases do not grant sibling privileges", () => {
    const report = check(
        'import { readFileSync as readFile } from "node:fs"; export function read(): string { return readFile("x", "utf8"); } export function bad(): string { return readFile("x", "utf8"); }',
        { adapters: [adapter] },
    );
    assert.equal(
        report.issues.filter((issue) => issue.rule === "implicit-capability")
            .length,
        1,
    );
});
void test("exceptions remain explicit in the report", () => {
    const report = check(
        "// @mycoscope-exception implicit-capability -- host supplies the clock\nexport const task: Effect.Effect<number, never, never> = Clock.currentTimeMillis;",
    );
    assert.deepEqual(report.issues, []);
    assert.equal(report.exceptions[0]?.reason, "host supplies the clock");
});

void test("ordinary pipe composition is accepted without granting capability access", () => {
    assert.deepEqual(
        check(
            "export const task: Effect.Effect<number, never, never> = Effect.succeed(1).pipe(Effect.map((n) => n + 1));",
        ).issues,
        [],
    );
});
void test("widened error and requirement channels are visibility gaps", () => {
    const report = check(
        "export const task: Effect.Effect<number, unknown, unknown> = Effect.succeed(1);",
    );
    assert.ok(report.issues.some((issue) => issue.rule === "effect-contract"));
});
void test("an unrelated export named main cannot use another modules root grant", () => {
    const report = check(
        'export function main(): Promise<number> { return Effect.runPromise(Effect.succeed(1)); } import "./other.js";',
        { wiringRoots: [{ module: "other.ts", export: "main" }] },
        { "other.ts": "export function main(): number { return 1; }" },
    );
    assert.ok(report.issues.some((issue) => issue.rule === "wiring-boundary"));
});

void test("nested exported Effects and union returns cannot hide inferred channels", () => {
    assert.ok(
        check("export const tasks = { read: Effect.succeed(1) };").issues.some(
            (issue) => issue.rule === "effect-contract",
        ),
    );
    assert.ok(
        check(
            "export function task(flag: boolean) { return flag ? Effect.succeed(1) : undefined; }",
        ).issues.some((issue) => issue.rule === "effect-contract"),
    );
});
void test("a Layer type alias must still declare all three channels", () => {
    assert.ok(
        check(
            "type Live = Layer.Layer<never>; export const live: Live = Layer.empty;",
        ).issues.some((issue) => issue.rule === "effect-contract"),
    );
    assert.deepEqual(
        check(
            "type Live = Layer.Layer<never, never, never>; export const live: Live = Layer.empty;",
        ).issues,
        [],
    );
});
void test("wiring roots must be callable local exports", () => {
    assert.ok(
        check("export const main = 1;", { wiringRoots: [root] }).issues.some(
            (issue) => issue.rule === "invalid-policy",
        ),
    );
});

void test("default service wrappers and direct I/O inside callbacks need an adapter", () => {
    const report = check(
        'import { readFileSync } from "node:fs"; export const task: Effect.Effect<string, never, never> = Effect.sync(() => readFileSync("x", "utf8"));',
    );
    assert.ok(
        report.issues.some((issue) => issue.rule === "implicit-capability"),
    );
    assert.ok(
        check(
            'export const task: Effect.Effect<void, never, never> = Effect.sleep("1 second");',
        ).issues.some((issue) => issue.rule === "implicit-capability"),
    );
});
void test("destructured provisioning cannot acquire a root privilege", () => {
    assert.ok(
        check(
            "const { runPromise: run } = Effect; export const promise = run(Effect.succeed(1));",
        ).issues.some((issue) => issue.rule === "wiring-boundary"),
    );
});
void test("stale exceptions fail instead of accumulating invisibly", () => {
    assert.ok(
        check(
            "// @mycoscope-exception implicit-capability -- no longer needed\nexport const n = 1;",
        ).issues.some((issue) => issue.rule === "exception-reason"),
    );
});
void test("an explicit exported object contract retains readable field contracts", () => {
    assert.deepEqual(
        check(
            "export const tasks: { readonly read: Effect.Effect<number, never, never> } = { read: Effect.succeed(1) };",
        ).issues,
        [],
    );
});

void test("a root cannot launder a runtime function through its return value", () => {
    assert.ok(
        check(
            "export function main(): typeof Effect.runPromise { return Effect.runPromise; } const run = main(); export function bad(): Promise<number> { return run(Effect.succeed(1)); }",
            { wiringRoots: [root] },
        ).issues.some((issue) => issue.rule === "wiring-boundary"),
    );
});
void test("literal element access preserves platform and Effect policy", () => {
    assert.ok(
        check(
            'export function wrong(): Promise<Response> { return globalThis["fetch"]("https://example.com"); }',
        ).issues.some((issue) => issue.rule === "implicit-capability"),
    );
    assert.ok(
        check(
            'export function main(): Promise<number> { return Effect["runPromise"](Effect.succeed(1)); }',
            { adapters: [root] },
        ).issues.some((issue) => issue.rule === "wiring-boundary"),
    );
});
void test("every explicit union arm must declare its own channels", () => {
    assert.ok(
        check(
            "export const task: Effect.Effect<number> | Effect.Effect<string, never, never> = Effect.succeed(1);",
        ).issues.some((issue) => issue.rule === "effect-contract"),
    );
});
void test("exported instances expose their Effect method contracts", () => {
    assert.ok(
        check(
            "export class Tasks { task(): Effect.Effect<number> { return Effect.succeed(1); } }",
        ).issues.some((issue) => issue.rule === "effect-contract"),
    );
    assert.deepEqual(
        check(
            "export class Tasks { task(): Effect.Effect<number, never, never> { return Effect.succeed(1); } }",
        ).issues,
        [],
    );
});
void test("template contents cannot manufacture a next-line exception", () => {
    const code =
        "const text = `${1}// @mycoscope-exception implicit-capability -- fake reason\n`; export const task: Effect.Effect<number, never, never> = Effect.sync(() => Date.now());";
    const report = check(code);
    assert.ok(
        report.issues.some((issue) => issue.rule === "implicit-capability"),
    );
    assert.deepEqual(report.exceptions, []);
});
void test("global Web Crypto requires an explicit adapter", () => {
    const report = check(
        "export function random(): Uint8Array { return crypto.getRandomValues(new Uint8Array(1)); }",
    );
    assert.ok(
        report.issues.some((issue) => issue.rule === "implicit-capability"),
    );
});

void test("known constructions remain accepted across supported overloads", () => {
    for (const value of [
        "Effect.provide(Effect.succeed(1), Layer.empty, { local: true })",
        "Effect.succeed(1).pipe(Effect.provide(Layer.empty, { local: true }))",
        'Effect.succeed(1).pipe(Effect.provideService(Reader)({ read: () => Effect.succeed("ok") }))',
    ]) {
        assert.deepEqual(
            check(
                SERVICE +
                    `export function main(): Effect.Effect<number, never, never> { return ${value}; }`,
                { wiringRoots: [root] },
            ).issues,
            [],
        );
    }
});
void test("computed execution and global crypto work in their designated scopes", () => {
    assert.deepEqual(
        check(
            'export function main(): Promise<number> { return Effect["runPromise"](Effect.succeed(1)); }',
            { wiringRoots: [root] },
        ).issues,
        [],
    );
    assert.deepEqual(
        check(
            "export function read(): Uint8Array { return crypto.getRandomValues(new Uint8Array(1)); }",
            { adapters: [adapter] },
        ).issues,
        [],
    );
});
