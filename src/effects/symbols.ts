import { relative } from "node:path";
import ts from "typescript";

// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
export function unalias(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
    return hasFlag(symbol.flags, ts.SymbolFlags.Alias)
        ? checker.getAliasedSymbol(symbol)
        : symbol;
}
export function symbolAt(
    node: ts.Node,
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    checker: ts.TypeChecker,
): ts.Symbol | undefined {
    const symbol =
        ts.isElementAccessExpression(node) &&
        ts.isStringLiteralLike(node.argumentExpression)
            ? checker
                  .getTypeAtLocation(node.expression)
                  .getProperty(node.argumentExpression.text)
            : checker.getSymbolAtLocation(node);
    return symbol === undefined ? undefined : unalias(symbol, checker);
}
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
export function unwrap(expression: ts.Expression): ts.Expression {
    return ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isSatisfiesExpression(expression) ||
        ts.isNonNullExpression(expression)
        ? unwrap(expression.expression)
        : expression;
}
// Follows value aliases too, including destructured namespace members. Does not trust a spelling.
export function apiSymbol(
    node: ts.Node,
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    checker: ts.TypeChecker,
    seen: ReadonlySet<ts.Symbol> = new Set(),
): ts.Symbol | undefined {
    if (ts.isCallExpression(node)) {
        if (checker.getTypeAtLocation(node).getCallSignatures().length === 0)
            return undefined;
        if (
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "bind"
        )
            return apiSymbol(node.expression.expression, checker, seen);
        const callee = apiSymbol(node.expression, checker, seen);
        if (effectModule(callee) !== undefined) return callee;
        if (callee === undefined || seen.has(callee)) return undefined;
        const declaration = callee.valueDeclaration;
        const returned: ts.Expression[] = [];
        function returns(current: ts.Node): void {
            if (
                ts.isReturnStatement(current) &&
                current.expression !== undefined
            )
                returned.push(current.expression);
            else if (!ts.isFunctionLike(current) || current === declaration)
                ts.forEachChild(current, returns);
        }
        if (
            declaration !== undefined &&
            ts.isVariableDeclaration(declaration) &&
            declaration.initializer !== undefined &&
            (ts.isArrowFunction(declaration.initializer) ||
                ts.isFunctionExpression(declaration.initializer))
        ) {
            const body = declaration.initializer.body;
            if (ts.isBlock(body)) ts.forEachChild(body, returns);
            else returned.push(body);
        } else if (declaration !== undefined) returns(declaration);
        const targets = returned.map((value) =>
            apiSymbol(value, checker, new Set([...seen, callee])),
        );
        const first = targets[0];
        return first !== undefined &&
            targets.every((target) => target === first)
            ? first
            : undefined;
    }
    const symbol = symbolAt(node, checker);
    if (symbol === undefined || seen.has(symbol)) return symbol;
    const declaration = symbol.valueDeclaration;
    const next = new Set([...seen, symbol]);
    if (
        declaration !== undefined &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined
    ) {
        const value = unwrap(declaration.initializer);
        if (
            ts.isIdentifier(value) ||
            ts.isPropertyAccessExpression(value) ||
            ts.isElementAccessExpression(value) ||
            ts.isCallExpression(value)
        )
            return apiSymbol(value, checker, next) ?? symbol;
    }
    if (
        declaration !== undefined &&
        ts.isBindingElement(declaration) &&
        ts.isObjectBindingPattern(declaration.parent)
    ) {
        const variable = declaration.parent.parent;
        if (
            ts.isVariableDeclaration(variable) &&
            variable.initializer !== undefined
        ) {
            const name = declaration.propertyName ?? declaration.name;
            if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
                const member = checker
                    .getTypeAtLocation(variable.initializer)
                    .getProperty(name.text);
                if (member !== undefined) return unalias(member, checker);
            }
        }
    }
    return symbol;
}
export function effectModule(
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    symbol: ts.Symbol | undefined,
): string | undefined {
    const declarations = symbol?.declarations ?? [];
    for (const declaration of declarations) {
        const match = /\/node_modules\/effect\/dist\/([^/]+)\.d\.ts$/.exec(
            declaration.getSourceFile().fileName,
        );
        if (match?.[1] !== undefined) return match[1];
    }
    return undefined;
}
export function ambientModule(
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    symbol: ts.Symbol | undefined,
): string | undefined {
    const declarations = symbol?.declarations ?? [];
    for (const declaration of declarations) {
        let parent: ts.Node | undefined = declaration;
        while (parent !== undefined) {
            if (
                ts.isModuleDeclaration(parent) &&
                ts.isStringLiteral(parent.name)
            )
                return parent.name.text.replace(/^node:/, "");
            parent = parentOf(parent);
        }
    }
    return undefined;
}
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
export function localFile(file: ts.SourceFile, root: string): boolean {
    const path = relative(root, file.fileName);
    return (
        !file.isDeclarationFile &&
        !path.startsWith("..") &&
        !path.includes("node_modules/")
    );
}
export function inType(node: ts.Node): boolean {
    let parent: ts.Node | undefined = node;
    while (parent !== undefined) {
        if (
            ts.isTypeNode(parent) ||
            ts.isImportDeclaration(parent) ||
            ts.isExportDeclaration(parent)
        )
            return true;
        if (ts.isStatement(parent)) return false;
        parent = parentOf(parent);
    }
    return false;
}

// TS declares Node.parent as always present; SourceFile has no parent at runtime.
export function parentOf(node: ts.Node): ts.Node | undefined {
    return node.parent;
}

export function hasFlag(value: number, flag: number): boolean {
    // eslint-disable-next-line no-bitwise -- TypeScript exposes compiler flags as bitmasks.
    return (value & flag) !== 0;
}
