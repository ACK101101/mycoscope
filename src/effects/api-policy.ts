import ts from "typescript";
import { ambientModule, effectModule } from "./symbols.js";

// An allowlist makes new Effect APIs visible gaps until reviewed. Unknown Effect APIs must live
// in an adapter and remain unverified; a version upgrade cannot silently introduce a default service.
const EFFECT_COMBINATORS = new Set([
    "Effect",
    "succeed",
    "fail",
    "failSync",
    "die",
    "dieSync",
    "gen",
    "map",
    "flatMap",
    "tap",
    "andThen",
    "as",
    "asVoid",
    "void",
    "all",
    "forEach",
    "match",
    "matchEffect",
    "catch",
    "catchTag",
    "catchTags",
    "catchIf",
    "catchCause",
    "mapError",
    "mapCause",
    "sync",
    "suspend",
    "promise",
    "tryPromise",
    "try",
    "callback",
    "acquireRelease",
    "acquireUseRelease",
    "addFinalizer",
    "ensuring",
    "onExit",
    "scoped",
    "service",
    "serviceOption",
    "context",
    "contextWith",
    "contextWithEffect",
    "provide",
    "provideService",
    "provideServiceEffect",
    "provideContext",
    "isEffect",
    "exit",
    "flip",
    "flatten",
    "zip",
    "zipWith",
    "zipLeft",
    "zipRight",
    "never",
    "interrupt",
    "interruptible",
    "uninterruptible",
    "uninterruptibleMask",
    "forkChild",
    "forkScoped",
    "forkDetach",
    "runPromise",
    "runPromiseWith",
    "runPromiseExit",
    "runPromiseExitWith",
    "runSync",
    "runSyncExit",
    "runFork",
    "runCallback",
]);
const LAYER_COMBINATORS = new Set([
    "Layer",
    "empty",
    "succeed",
    "succeedContext",
    "effect",
    "effectContext",
    "sync",
    "suspend",
    "merge",
    "mergeAll",
    "provide",
    "provideMerge",
    "map",
    "flatMap",
    "unwrap",
    "orDie",
    "catch",
    "catchCause",
    "isLayer",
    "build",
    "buildWithScope",
    "launch",
]);
const CONTEXT_COMBINATORS = new Set([
    "Service",
    "make",
    "empty",
    "add",
    "merge",
    "mergeAll",
    "get",
    "getOption",
    "getOrElse",
    "pick",
    "omit",
    "isContext",
    "isKey",
]);
const RAW_MODULE =
    /^(?:fs(?:\/.*)?|child_process|http(?:2)?|https|net|tls|dgram|dns(?:\/.*)?|worker_threads|cluster|readline(?:\/.*)?|timers(?:\/.*)?|perf_hooks|os|process|crypto|sqlite)$/;
const GLOBAL_CAPABILITIES = new Set([
    "fetch",
    "setTimeout",
    "setInterval",
    "setImmediate",
    "queueMicrotask",
    "WebSocket",
    "crypto",
]);

// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
export function isWiring(symbol: ts.Symbol | undefined): boolean {
    const module = effectModule(symbol);
    const name = symbol?.getName() ?? "";
    return (
        (module === "Effect" &&
            (name.startsWith("provide") || name.startsWith("run"))) ||
        (module === "Layer" &&
            (name.startsWith("build") || name === "launch")) ||
        module === "ManagedRuntime"
    );
}
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
export function isProvider(symbol: ts.Symbol | undefined): boolean {
    const module = effectModule(symbol);
    return (
        (module === "Effect" || module === "Layer") &&
        (symbol?.getName().startsWith("provide") ?? false)
    );
}
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
export function isCapability(symbol: ts.Symbol | undefined): boolean {
    if (symbol === undefined) return false;
    const module = effectModule(symbol);
    const name = symbol.getName();
    if (module === "Effect") return !EFFECT_COMBINATORS.has(name);
    if (module === "Layer") return !LAYER_COMBINATORS.has(name);
    if (module === "Context") return !CONTEXT_COMBINATORS.has(name);
    if (module === "ManagedRuntime") return false;
    if ((module === "Pipeable" || module === "Function") && name === "pipe")
        return false;
    if (module !== undefined) return true;
    if (RAW_MODULE.test(ambientModule(symbol) ?? "")) return true;
    // Global platform APIs and default objects have no import declaration.
    return (
        symbol.declarations?.some((declaration) => {
            const file = declaration.getSourceFile().fileName;
            return (
                (file.includes("/typescript/lib/") ||
                    file.includes("/@types/node/")) &&
                ((ts.isInterfaceDeclaration(declaration.parent) &&
                    [
                        "Crypto",
                        "SubtleCrypto",
                        "WebSocket",
                        "Worker",
                        "MessagePort",
                        "BroadcastChannel",
                        "XMLHttpRequest",
                    ].includes(declaration.parent.name.text)) ||
                    GLOBAL_CAPABILITIES.has(name) ||
                    [
                        "Date",
                        "now",
                        "random",
                        "console",
                        "process",
                        "env",
                    ].includes(name) ||
                    file.endsWith("/console.d.ts"))
            );
        }) ?? false
    );
}
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
export function isProcessLaunch(symbol: ts.Symbol | undefined): boolean {
    return (
        ambientModule(symbol) === "child_process" &&
        [
            "spawn",
            "spawnSync",
            "exec",
            "execSync",
            "execFile",
            "execFileSync",
            "fork",
        ].includes(symbol?.getName() ?? "")
    );
}
