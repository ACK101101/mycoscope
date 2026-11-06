import { operation } from "./operations.js";
import { comments } from "./comments.js";
import { findContracts } from "./contracts.js";
import { relative, resolve } from "node:path";
import ts from "typescript";
import type { Mut } from "../mutation.js";
import type {
    Contract,
    Edge,
    Exception,
    GraphNode,
    Issue,
    Policy,
    Report,
    Rule,
    Site,
    SymbolRef,
} from "./model.js";
import {
    parentOf,
    hasFlag,
    apiSymbol,
    effectModule,
    inType,
    localFile,
    symbolAt,
    unalias,
    unwrap,
} from "./symbols.js";
import {
    isCapability,
    isProcessLaunch,
    isProvider,
    isWiring,
} from "./api-policy.js";

export const RULES = {
    "effect-contract": true,
    "wiring-boundary": true,
    "unresolved-wiring": true,
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
function isConst(declaration: ts.VariableDeclaration): boolean {
    return (
        ts.isVariableDeclarationList(declaration.parent) &&
        hasFlag(declaration.parent.flags, ts.NodeFlags.Const)
    );
}
// Whole-program analysis, rather than a file lint rule: policy exports and construction aliases
// need a shared symbol table. Edges mean possible static dependencies, not runtime execution order.
export function analyze(program: ts.Program, policy: Policy): Report {
    const checker = program.getTypeChecker();
    const nodes: Mut<GraphNode[]> = [];
    const edges: Mut<Edge[]> = [];
    const contracts: Mut<Contract[]> = [];
    const issues: Mut<Issue[]> = [];
    const exceptions: Mut<Exception[]> = [];
    const files = program
        .getSourceFiles()
        .filter((file) => localFile(file, policy.rootDirectory));
    const ids: Mut<Map<ts.Symbol, string>> = new Map();
    const issueKeys: Mut<Set<string>> = new Set();
    const edgeKeys: Mut<Set<string>> = new Set();
    const directives: Mut<
        Map<
            string,
            {
                readonly site: Site;
                readonly rule: string;
                readonly reason: string;
            }
        >
    > = new Map();
    const usedDirectives: Mut<Set<string>> = new Set();
    const reassigned: Mut<Set<ts.Symbol>> = new Set();
    function written(node: ts.Node): void {
        const symbol = symbolAt(node, checker);
        if (symbol !== undefined) reassigned.add(symbol);
        ts.forEachChild(node, written);
    }
    for (const file of files) {
        function assignments(node: ts.Node): void {
            if (
                ts.isBinaryExpression(node) &&
                node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
                node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
            )
                written(node.left);
            if (
                (ts.isPrefixUnaryExpression(node) ||
                    ts.isPostfixUnaryExpression(node)) &&
                (node.operator === ts.SyntaxKind.PlusPlusToken ||
                    node.operator === ts.SyntaxKind.MinusMinusToken)
            )
                written(node.operand);
            if (ts.isDeleteExpression(node)) written(node.expression);
            ts.forEachChild(node, assignments);
        }
        assignments(file);
    }

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
    function addEdge(from: string, to: string, kind: Edge["kind"]): void {
        const key = `${from}:${to}:${kind}`;
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        edges.push({ from, to, kind });
    }
    function symbolNode(symbol: ts.Symbol): string {
        const canonical = unalias(symbol, checker);
        const known = ids.get(canonical);
        if (known !== undefined) return known;
        const declaration =
            canonical.valueDeclaration ?? canonical.declarations?.[0];
        const location =
            declaration === undefined
                ? { file: "<unresolved>", line: 0 }
                : site(declaration, policy.rootDirectory);
        const id = `${location.file}:${String(declaration?.pos ?? 0)}:${canonical.getName()}`;
        ids.set(canonical, id);
        nodes.push({
            ...location,
            id,
            label: canonical.getName(),
            verification:
                declaration !== undefined &&
                localFile(declaration.getSourceFile(), policy.rootDirectory) &&
                !ts.isParameter(declaration) &&
                !ts.isPropertySignature(declaration) &&
                !ts.isMethodSignature(declaration) &&
                !(
                    ts.isVariableDeclaration(declaration) &&
                    declaration.initializer === undefined
                ) &&
                !(
                    ts.isFunctionDeclaration(declaration) &&
                    declaration.body === undefined
                )
                    ? "local"
                    : "unverified",
        });
        return id;
    }
    function moduleNode(file: ts.SourceFile): string {
        const id = relative(policy.rootDirectory, file.fileName);
        if (!nodes.some((node) => node.id === id))
            nodes.push({
                id,
                file: id,
                line: 1,
                label: id,
                verification: "local",
            });
        return id;
    }
    function owner(node: ts.Node): string {
        let parent: ts.Node | undefined = node;
        while (parent !== undefined) {
            const name = declarationName(parent);
            const symbol =
                name === undefined ? undefined : symbolAt(name, checker);
            if (symbol !== undefined) return symbolNode(symbol);
            parent = parentOf(parent);
        }
        return moduleNode(node.getSourceFile());
    }
    function resolveRefs(
        refs: readonly SymbolRef[],
        callable = false,
    ): ReadonlySet<ts.Symbol> {
        const result: Mut<Set<ts.Symbol>> = new Set();
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
    const executables: Mut<Map<string, string>> = new Map();
    const declaredExecutables = policy.executables ?? [];
    for (const executable of declaredExecutables) {
        const targets = resolveRefs([executable.root], true);
        for (const target of targets) {
            if (roots.has(target)) {
                executables.set(executable.command, symbolNode(target));
            } else {
                issues.push({
                    file: executable.root.module,
                    line: 1,
                    rule: "invalid-policy",
                    message:
                        "A child executable must refer to a configured wiring root.",
                });
            }
        }
    }

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
    function recoverable(
        expression: ts.Expression,
        seen: ReadonlySet<ts.Symbol> = new Set(),
    ): boolean {
        const value = unwrap(expression);
        if (
            ts.isConditionalExpression(value) ||
            ts.isElementAccessExpression(value) ||
            ts.isAwaitExpression(value) ||
            ts.isSpreadElement(value)
        )
            return false;
        if (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value)) {
            const symbol = symbolAt(value, checker);
            if (
                symbol === undefined ||
                seen.has(symbol) ||
                reassigned.has(symbol)
            )
                return false;
            const declaration = symbol.valueDeclaration;
            if (declaration === undefined)
                return effectModule(symbol) !== undefined;
            if (!localFile(declaration.getSourceFile(), policy.rootDirectory))
                return true; // known external target: explicitly unverified in the graph
            if (
                ts.isVariableDeclaration(declaration) &&
                declaration.initializer !== undefined
            )
                return (
                    isConst(declaration) &&
                    recoverable(
                        declaration.initializer,
                        new Set([...seen, symbol]),
                    )
                );
            return (
                ts.isFunctionDeclaration(declaration) ||
                ts.isClassDeclaration(declaration) ||
                ts.isMethodDeclaration(declaration)
            );
        }
        if (ts.isCallExpression(value)) {
            if (value.expression.kind === ts.SyntaxKind.ImportKeyword)
                return false;
            if (
                ts.isPropertyAccessExpression(value.expression) &&
                value.expression.name.text === "pipe"
            )
                return (
                    recoverable(value.expression.expression, seen) &&
                    value.arguments.every((argument) =>
                        recoverable(argument, seen),
                    )
                );
            const symbol = apiSymbol(value.expression, checker);
            if (symbol === undefined || reassigned.has(symbol)) return false;
            if (effectModule(symbol) !== undefined)
                return value.arguments.every((argument) =>
                    recoverable(argument, seen),
                );
            const declaration = symbol.valueDeclaration;
            if (declaration === undefined) return false;
            if (ts.isVariableDeclaration(declaration) && !isConst(declaration))
                return false;
            if (!localFile(declaration.getSourceFile(), policy.rootDirectory))
                return true;
            if (seen.has(symbol)) return false;
            const returned: Mut<ts.Expression[]> = [];
            function returns(node: ts.Node): void {
                if (ts.isReturnStatement(node) && node.expression !== undefined)
                    returned.push(node.expression);
                else if (!ts.isFunctionLike(node) || node === declaration)
                    ts.forEachChild(node, returns);
            }
            if (
                ts.isVariableDeclaration(declaration) &&
                declaration.initializer !== undefined &&
                ts.isArrowFunction(declaration.initializer)
            ) {
                const body = declaration.initializer.body;
                if (ts.isBlock(body)) ts.forEachChild(body, returns);
                else returned.push(body);
            } else returns(declaration);
            return (
                returned.length > 0 &&
                returned.every((item) =>
                    recoverable(item, new Set([...seen, symbol])),
                )
            );
        }
        if (ts.isArrayLiteralExpression(value))
            return value.elements.every(
                (item) => ts.isExpression(item) && recoverable(item, seen),
            );
        if (ts.isObjectLiteralExpression(value))
            return value.properties.every(
                (property) =>
                    ts.isMethodDeclaration(property) ||
                    (ts.isPropertyAssignment(property) &&
                        recoverable(property.initializer, seen)) ||
                    (ts.isShorthandPropertyAssignment(property) &&
                        recoverable(property.name, seen)),
            );
        return (
            ts.isArrowFunction(value) ||
            ts.isFunctionExpression(value) ||
            ts.isLiteralExpression(value) ||
            value.kind === ts.SyntaxKind.TrueKeyword ||
            value.kind === ts.SyntaxKind.FalseKeyword ||
            value.kind === ts.SyntaxKind.NullKeyword
        );
    }
    function checkExport(exported: ts.Symbol): void {
        for (const contract of findContracts(
            exported,
            checker,
            policy.rootDirectory,
        )) {
            const { symbol, declaration, type, explicit } = contract;
            const args = checker.getTypeArguments(type);
            const kind =
                effectModule(type.getSymbol()) === "Effect"
                    ? "Effect"
                    : "Layer";
            contracts.push({
                ...site(declaration, policy.rootDirectory),
                node: symbolNode(symbol),
                kind,
                success: checker.typeToString(args[0] ?? type),
                error:
                    args[1] === undefined
                        ? "never"
                        : checker.typeToString(args[1]),
                requirements:
                    args[2] === undefined
                        ? "never"
                        : checker.typeToString(args[2]),
            });
            function requirement(type: ts.Type): void {
                const required = type.getSymbol();
                if (required !== undefined)
                    addEdge(
                        symbolNode(symbol),
                        symbolNode(required),
                        "requires",
                    );
                if (type.isUnionOrIntersection())
                    for (const part of type.types) requirement(part);
            }
            if (args[2] !== undefined) requirement(args[2]);
            if (!explicit)
                issue(
                    declaration,
                    "effect-contract",
                    "Exported Effect/Layer surfaces need explicit three-channel contracts with no any/unknown E or R.",
                );
        }
    }
    for (const file of files) {
        moduleNode(file);
        const module = checker.getSymbolAtLocation(file);
        if (module !== undefined)
            for (const symbol of checker.getExportsOfModule(module))
                checkExport(symbol);
        function visit(node: ts.Node): void {
            if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
                const specifier = node.moduleSpecifier;
                const imported =
                    specifier === undefined
                        ? undefined
                        : symbolAt(specifier, checker);
                if (imported !== undefined)
                    addEdge(
                        moduleNode(file),
                        symbolNode(imported),
                        "references",
                    );
            }
            const name = declarationName(node);
            if (name !== undefined) {
                const symbol = symbolAt(name, checker);
                if (symbol !== undefined)
                    addEdge(owner(node.parent), symbolNode(symbol), "contains");
            }
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
                const symbol = symbolAt(node, checker);
                const api = apiSymbol(node, checker);
                if (symbol !== undefined) {
                    const target = symbolNode(symbol);
                    addEdge(
                        owner(node),
                        target,
                        isCapability(api) ? "capability" : "references",
                    );
                }
                const receiver =
                    (ts.isPropertyAccessExpression(node.parent) ||
                        ts.isElementAccessExpression(node.parent)) &&
                    node.parent.expression === node;
                if (!receiver && isWiring(api) && !allowed(node, roots))
                    issue(
                        node,
                        "wiring-boundary",
                        "Provisioning and execution belong in a configured wiring-root export.",
                    );
                if (!receiver && isCapability(api) && !allowed(node, adapters))
                    issue(
                        node,
                        "implicit-capability",
                        "Use a configured adapter for raw I/O, implicit defaults, or an unaudited Effect API.",
                    );
            }
            if (ts.isCallExpression(node)) {
                const resolved = operation(node, checker);
                const api = resolved.target;
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
                if (api !== undefined)
                    addEdge(
                        owner(node),
                        symbolNode(api),
                        isCapability(api) ? "capability" : "references",
                    );
                if (
                    (isProvider(api) || isWiring(api)) &&
                    resolved.inputs.some((input) => !recoverable(input))
                )
                    issue(
                        node,
                        "unresolved-wiring",
                        "The construction cannot be recovered statically; use a named construction or a reasoned exception.",
                    );
                if (isProcessLaunch(api)) {
                    const command = node.arguments[0];
                    if (
                        command === undefined ||
                        !ts.isStringLiteralLike(command)
                    )
                        issue(
                            node,
                            "unresolved-wiring",
                            "A dynamic child executable needs a reasoned exception.",
                        );
                    else {
                        const id = `process:${command.text}`;
                        if (!nodes.some((item) => item.id === id))
                            nodes.push({
                                ...site(node, policy.rootDirectory),
                                id,
                                label: command.text,
                                verification: "unverified",
                            });
                        addEdge(owner(node), id, "launches");
                        const root = executables.get(command.text);
                        if (root !== undefined) addEdge(id, root, "launches");
                    }
                }
                if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
                    issue(
                        node,
                        "unresolved-wiring",
                        "Dynamic module loading needs a reasoned exception.",
                    );
            }
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
    return {
        wiringRoots: [...roots].map((symbol) => symbolNode(symbol)),
        adapters: [...adapters].map((symbol) => symbolNode(symbol)),
        nodes,
        edges,
        contracts,
        issues,
        exceptions,
    };
}
