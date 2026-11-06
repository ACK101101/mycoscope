import ts from "typescript";
import type { Mut } from "../mutation.js";
import {
    effectModule,
    hasFlag,
    localFile,
    symbolAt,
    unalias,
} from "./symbols.js";

function isReference(type: ts.Type): type is ts.TypeReference {
    return (
        hasFlag(type.flags, ts.TypeFlags.Object) &&
        "objectFlags" in type &&
        typeof type.objectFlags === "number" &&
        hasFlag(type.objectFlags, ts.ObjectFlags.Reference)
    );
}
function widened(type: ts.Type): boolean {
    return (
        hasFlag(type.flags, ts.TypeFlags.Any) ||
        hasFlag(type.flags, ts.TypeFlags.Unknown) ||
        (type.isUnionOrIntersection() &&
            type.types.some((part) => widened(part)))
    );
}
function contractAnnotations(
    node: ts.Node,
    checker: ts.TypeChecker,
    seen: ReadonlySet<ts.Symbol> = new Set(),
): readonly boolean[] {
    const checks: Mut<boolean[]> = [];
    if (ts.isTypeReferenceNode(node)) {
        const symbol = symbolAt(node.typeName, checker);
        const module = effectModule(symbol);
        if (
            (module === "Effect" || module === "Layer") &&
            symbol?.getName() === module
        )
            checks.push(node.typeArguments?.length === 3);
        else if (symbol !== undefined && !seen.has(symbol)) {
            const declarations = symbol.declarations ?? [];
            for (const declaration of declarations)
                if (ts.isTypeAliasDeclaration(declaration))
                    checks.push(
                        ...contractAnnotations(
                            declaration.type,
                            checker,
                            new Set([...seen, symbol]),
                        ),
                    );
        }
    }
    ts.forEachChild(node, (child) => {
        checks.push(...contractAnnotations(child, checker, seen));
    });
    return checks;
}
function explicitContract(node: ts.Node, checker: ts.TypeChecker): boolean {
    const annotations = contractAnnotations(node, checker);
    return annotations.length > 0 && annotations.every((complete) => complete);
}

interface DeclarationContract {
    readonly symbol: ts.Symbol;
    readonly declaration: ts.Declaration;
    readonly type: ts.TypeReference;
    readonly explicit: boolean;
}
export function findContracts(
    exported: ts.Symbol,
    checker: ts.TypeChecker,
    root: string,
): readonly DeclarationContract[] {
    const found: Mut<DeclarationContract[]> = [];
    function visit(
        type: ts.Type,
        symbol: ts.Symbol,
        declaration: ts.Declaration,
        seen: ReadonlySet<ts.Type>,
    ): void {
        if (seen.has(type)) return;
        const next = new Set([...seen, type]);
        const module = effectModule(type.getSymbol());
        if (
            isReference(type) &&
            (module === "Effect" || module === "Layer") &&
            type.getSymbol()?.getName() === module
        ) {
            const annotation =
                ts.isVariableDeclaration(declaration) ||
                ts.isFunctionLike(declaration) ||
                ts.isPropertySignature(declaration) ||
                ts.isPropertyDeclaration(declaration)
                    ? declaration.type
                    : undefined;
            found.push({
                symbol,
                declaration,
                type,
                explicit:
                    annotation !== undefined &&
                    explicitContract(annotation, checker) &&
                    !checker
                        .getTypeArguments(type)
                        .slice(1)
                        .some((argument) => widened(argument)),
            });
            return;
        }
        if (type.isUnionOrIntersection())
            for (const part of type.types)
                visit(part, symbol, declaration, next);
        for (const signature of type.getCallSignatures())
            visit(
                checker.getReturnTypeOfSignature(signature),
                symbol,
                signature.declaration ?? declaration,
                next,
            );
        for (const signature of type.getConstructSignatures())
            visit(
                checker.getReturnTypeOfSignature(signature),
                symbol,
                declaration,
                next,
            );
        for (const property of type.getProperties()) {
            const member = property.valueDeclaration;
            if (member !== undefined && localFile(member.getSourceFile(), root))
                visit(
                    checker.getTypeOfSymbolAtLocation(property, member),
                    property,
                    member,
                    next,
                );
        }
    }
    const symbol = unalias(exported, checker);
    const declaration = symbol.valueDeclaration;
    if (
        declaration !== undefined &&
        localFile(declaration.getSourceFile(), root)
    )
        visit(
            checker.getTypeOfSymbolAtLocation(symbol, declaration),
            symbol,
            declaration,
            new Set(),
        );
    return found;
}
