import { calledApi } from "./operations.js";
import { comments } from "./comments.js";
import { findContracts } from "./contracts.js";
import { relative, resolve } from "node:path";
import ts from "typescript";
import type {
    Exception,
    Findings,
    Issue,
    Policy,
    Rule,
    Site,
    SymbolRef,
} from "./model.js";
import {
    parentOf,
    apiSymbol,
    inType,
    localFile,
    symbolAt,
    unalias,
} from "./symbols.js";
import { isCapability, isWiring } from "./api-policy.js";

export const RULES = {
    "effect-contract": true,
    "wiring-boundary": true,
    "implicit-capability": true,
    "invalid-policy": true,
    "exception-reason": true,
} satisfies Readonly<Record<Rule, true>>;

function site(node: ts.Node, root: string): Site {
    const file = node.getSourceFile();
    return {
        file: relative(root, file.fileName),
        line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
    };
}
function declarationName(node: ts.Node): ts.DeclarationName | undefined {
    return ts.isVariableDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isPropertyAssignment(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isParameter(node)
        ? node.name
        : undefined;
}
// Whole-program analysis, rather than a file lint rule: exported contracts and policy exports
// need a shared symbol table.
export function analyze(program: ts.Program, policy: Policy): Findings {
    const checker = program.getTypeChecker();
    const issues: Issue[] = [];
    const exceptions: Exception[] = [];
    const files = program
        .getSourceFiles()
        .filter((file) => localFile(file, policy.rootDirectory));
    const issueKeys = new Set<string>();
    const directives = new Map<
        string,
        {
            readonly site: Site;
            readonly rule: string;
            readonly reason: string;
        }
    >();
    const usedDirectives = new Set<string>();

    for (const file of files) {
        for (const comment of comments(file)) {
            const match =
                /^\/\/\s*@mycoscope-exception\s+(\S+)(?:\s+--\s+(.+))?$/.exec(
                    file.text.slice(comment.pos, comment.end),
                );
            if (match === null) continue;
            const line =
                file.getLineAndCharacterOfPosition(comment.pos).line + 1;
            const location = {
                file: relative(policy.rootDirectory, file.fileName),
                line,
            };
            const rule = match[1] ?? "";
            const reason = match[2]?.trim() ?? "";
            const key = `${location.file}:${String(line + 1)}:${rule}`;
            directives.set(key, { site: location, rule, reason });
            if (
                !Object.hasOwn(RULES, rule) ||
                reason.length === 0 ||
                rule === "exception-reason" ||
                rule === "invalid-policy"
            )
                issues.push({
                    ...location,
                    rule: "exception-reason",
                    message:
                        "Use a known suppressible rule and a reason after ` -- ` on a next-line exception.",
                });
        }
    }
    function issue(node: ts.Node, rule: Rule, message: string): void {
        const location = site(node, policy.rootDirectory);
        const key = `${location.file}:${String(location.line)}:${rule}`;
        if (issueKeys.has(key)) return;
        issueKeys.add(key);
        const directive = directives.get(key);
        const item = { ...location, rule, message };
        if (
            directive !== undefined &&
            directive.reason.length > 0 &&
            rule !== "invalid-policy" &&
            rule !== "exception-reason"
        ) {
            usedDirectives.add(key);
            exceptions.push({ ...item, reason: directive.reason });
        } else issues.push(item);
    }
    function resolveRefs(
        refs: readonly SymbolRef[],
        callable = false,
    ): ReadonlySet<ts.Symbol> {
        const result = new Set<ts.Symbol>();
        for (const ref of refs) {
            const file = files.find(
                (candidate) =>
                    resolve(candidate.fileName) ===
                    resolve(policy.rootDirectory, ref.module),
            );
            const module =
                file === undefined
                    ? undefined
                    : checker.getSymbolAtLocation(file);
            const exported =
                module === undefined
                    ? undefined
                    : checker
                          .getExportsOfModule(module)
                          .find((symbol) => symbol.getName() === ref.export);
            const symbol =
                exported === undefined ? undefined : unalias(exported, checker);
            if (
                symbol?.valueDeclaration === undefined ||
                !localFile(
                    symbol.valueDeclaration.getSourceFile(),
                    policy.rootDirectory,
                )
            ) {
                issues.push({
                    file: ref.module,
                    line: 1,
                    rule: "invalid-policy",
                    message: `Cannot resolve local value export ${ref.export}.`,
                });
            } else if (
                callable &&
                checker
                    .getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration)
                    .getCallSignatures().length === 0
            ) {
                issues.push({
                    file: ref.module,
                    line: 1,
                    rule: "invalid-policy",
                    message: "A wiring-root export must be callable.",
                });
            } else result.add(symbol);
        }
        return result;
    }
    const roots = resolveRefs(policy.wiringRoots, true);
    const adapters = resolveRefs(policy.adapters);

    function allowed(node: ts.Node, symbols: ReadonlySet<ts.Symbol>): boolean {
        let parent: ts.Node | undefined = node;
        while (parent !== undefined) {
            const name = declarationName(parent);
            const symbol =
                name === undefined ? undefined : symbolAt(name, checker);
            if (symbol !== undefined && symbols.has(symbol)) return true;
            parent = parentOf(parent);
        }
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    function checkExport(exported: ts.Symbol): void {
        for (const { declaration, explicit } of findContracts(
            exported,
            checker,
            policy.rootDirectory,
        ))
            if (!explicit)
                issue(
                    declaration,
                    "effect-contract",
                    "Exported Effect/Layer surfaces need explicit three-channel contracts with no any/unknown E or R.",
                );
    }
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    function checkApi(node: ts.Node, api: ts.Symbol | undefined): void {
        if (isWiring(api) && !allowed(node, roots))
            issue(
                node,
                "wiring-boundary",
                "Provisioning and execution belong in a configured wiring-root export.",
            );
        if (isCapability(api) && !allowed(node, adapters))
            issue(
                node,
                "implicit-capability",
                "Use a configured adapter for raw I/O, implicit defaults, or an unaudited Effect API.",
            );
    }
    for (const file of files) {
        const module = checker.getSymbolAtLocation(file);
        if (module !== undefined)
            for (const symbol of checker.getExportsOfModule(module))
                checkExport(symbol);
        function visit(node: ts.Node): void {
            if (
                (ts.isIdentifier(node) ||
                    ts.isPropertyAccessExpression(node) ||
                    ts.isElementAccessExpression(node)) &&
                !(
                    ts.isIdentifier(node) &&
                    ts.isPropertyAccessExpression(node.parent) &&
                    node.parent.name === node
                ) &&
                declarationName(node.parent) !== node &&
                !inType(node)
            ) {
                const receiver =
                    (ts.isPropertyAccessExpression(node.parent) ||
                        ts.isElementAccessExpression(node.parent)) &&
                    node.parent.expression === node;
                if (!receiver) checkApi(node, apiSymbol(node, checker));
            }
            if (ts.isCallExpression(node))
                checkApi(node, calledApi(node, checker));
            ts.forEachChild(node, visit);
        }
        visit(file);
    }
    for (const [key, directive] of directives) {
        if (
            !usedDirectives.has(key) &&
            directive.reason.length > 0 &&
            Object.hasOwn(RULES, directive.rule)
        )
            issues.push({
                ...directive.site,
                rule: "exception-reason",
                message:
                    "This exception did not suppress a matching issue on the next line.",
            });
    }
    return { issues, exceptions };
}
