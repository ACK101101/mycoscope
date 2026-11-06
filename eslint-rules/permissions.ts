import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { Mut } from "../src/mutation.js";

// 0 = read, 1 = shallow write, 2 = deep write. A grant is not ownership.
export type Permission = 0 | 1 | 2;
const MARKERS = fileURLToPath(new URL("../src/mutation.ts", import.meta.url));

export interface Source {
    readonly node: ts.Expression | undefined;
    readonly type: ts.Type;
    readonly permission: Permission;
    readonly fresh: boolean;
    readonly deepFresh: boolean;
}

interface Visit {
    readonly type: ts.Type;
    readonly target: ts.Type;
    readonly permission: Permission;
    readonly node: ts.Expression | undefined;
}

export interface Permissions {
    readonly permitsFields: (value: Source, target: ts.Type) => boolean;
    readonly permission: (
        type: ts.Type,
        seen?: readonly ts.Type[],
    ) => Permission;
    readonly source: (
        expression: ts.Expression,
        seen?: readonly ts.Node[],
    ) => Source;
    readonly child: (value: Source, key: string) => Source | undefined;
    readonly permits: (
        value: Source,
        target: ts.Type,
        seen?: readonly Visit[],
    ) => boolean;
    readonly grants: (value: Source, required: Permission) => boolean;
}

function hasFlag(type: ts.Type, flag: ts.TypeFlags): boolean {
    // eslint-disable-next-line no-bitwise -- TypeScript exposes type categories as bit masks.
    return (type.flags & flag) !== 0;
}

export function createPermissions(program: ts.Program): Permissions {
    const checker = program.getTypeChecker();

    function permission(
        type: ts.Type,
        seen: readonly ts.Type[] = [],
    ): Permission {
        if (seen.includes(type)) return 0;
        if (type.isUnion()) {
            const modes = type.types
                .filter(
                    (part) =>
                        !hasFlag(part, ts.TypeFlags.Undefined) &&
                        !hasFlag(part, ts.TypeFlags.Null),
                )
                .map((part) => permission(part, [...seen, type]));
            let result: Permission = modes.length === 0 ? 0 : 2;
            for (const mode of modes) if (mode < result) result = mode;
            return result;
        }
        if (hasFlag(type, ts.TypeFlags.TypeParameter)) {
            const constraint = checker.getBaseConstraintOfType(type);
            return constraint === undefined
                ? 0
                : permission(constraint, [...seen, type]);
        }
        const marker = type
            .getProperties()
            .find(
                (property) =>
                    property.declarations?.some(
                        (declaration) =>
                            declaration.getSourceFile().fileName === MARKERS &&
                            ts.isPropertySignature(declaration) &&
                            ts.isComputedPropertyName(declaration.name) &&
                            declaration.name.expression.getText() ===
                                "mutationPermission",
                    ) === true,
            );
        const declaration =
            marker?.valueDeclaration ?? marker?.declarations?.[0];
        if (marker === undefined || declaration === undefined) return 0;
        const mode = checker.getTypeOfSymbolAtLocation(marker, declaration);
        const parts = mode.isUnion() ? mode.types : [mode];
        if (
            parts.some(
                (part) => part.isStringLiteral() && part.value === "deep",
            )
        )
            return 2;
        return parts.some(
            (part) => part.isStringLiteral() && part.value === "shallow",
        )
            ? 1
            : 0;
    }

    function unwrapped(node: ts.Expression): ts.Expression {
        if (
            ts.isParenthesizedExpression(node) ||
            ts.isAsExpression(node) ||
            ts.isTypeAssertionExpression(node) ||
            ts.isSatisfiesExpression(node) ||
            ts.isNonNullExpression(node)
        ) {
            return unwrapped(node.expression);
        }
        return node;
    }

    function isPrimitive(type: ts.Type): boolean {
        if (type.isUnion())
            return type.types.every((part) => isPrimitive(part));
        return [
            ts.TypeFlags.StringLike,
            ts.TypeFlags.NumberLike,
            ts.TypeFlags.BooleanLike,
            ts.TypeFlags.BigIntLike,
            ts.TypeFlags.ESSymbolLike,
            ts.TypeFlags.Null,
            ts.TypeFlags.Undefined,
            ts.TypeFlags.Never,
        ].some((flag) => hasFlag(type, flag));
    }

    function propertyType(
        type: ts.Type,
        key: string,
        location: ts.Node,
    ): ts.Type | undefined {
        const property = type.getProperty(key);
        if (property !== undefined)
            return checker.getTypeOfSymbolAtLocation(property, location);
        return checker.getIndexTypeOfType(
            type,
            /^\d+$/.test(key) || key === "*"
                ? ts.IndexKind.Number
                : ts.IndexKind.String,
        );
    }

    function isStructuredClone(node: ts.CallExpression): boolean {
        const symbol = checker.getSymbolAtLocation(node.expression);
        return (
            symbol?.getName() === "structuredClone" &&
            symbol.declarations?.every(
                (decl) => decl.getSourceFile().isDeclarationFile,
            ) === true
        );
    }

    function freshConstruction(node: ts.NewExpression): boolean {
        const declaration = checker.getResolvedSignature(node)?.declaration;
        if (
            declaration !== undefined &&
            program.isSourceFileDefaultLibrary(declaration.getSourceFile())
        ) {
            const name = node.expression.getText();
            if (/Array$|^DataView$/u.test(name)) {
                const argument = node.arguments?.[0];
                if (argument !== undefined) {
                    const type = checker.getTypeAtLocation(argument);
                    if (
                        ["ArrayBuffer", "SharedArrayBuffer"].includes(
                            type.getSymbol()?.getName() ?? "",
                        )
                    )
                        return source(argument).permission > 0;
                }
            }
            return true;
        }
        const classDeclaration = checker
            .getSymbolAtLocation(node.expression)
            ?.declarations?.find((item) => ts.isClassDeclaration(item));
        if (
            classDeclaration === undefined ||
            !ts.isClassDeclaration(classDeclaration) ||
            classDeclaration.heritageClauses !== undefined
        )
            return false;
        let returnsObject = false;
        function visit(item: ts.Node): void {
            if (ts.isReturnStatement(item) && item.expression !== undefined)
                returnsObject = true;
            if (ts.isFunctionLike(item)) return;
            ts.forEachChild(item, visit);
        }
        for (const member of classDeclaration.members) {
            if (
                ts.isConstructorDeclaration(member) &&
                member.body !== undefined
            )
                visit(member.body);
        }
        return !returnsObject;
    }

    function source(
        expression: ts.Expression,
        seen: readonly ts.Node[] = [],
    ): Source {
        const node = unwrapped(expression);
        const type = checker.getTypeAtLocation(node);
        let mode = permission(type);
        if (ts.isIdentifier(node) && !seen.includes(node)) {
            const symbol = checker.getSymbolAtLocation(node);
            const declaration = symbol?.valueDeclaration;
            if (declaration !== undefined && !seen.includes(declaration)) {
                const next = [...seen, node, declaration];
                if (
                    ts.isVariableDeclaration(declaration) &&
                    declaration.type === undefined
                ) {
                    if (declaration.initializer !== undefined)
                        mode = source(declaration.initializer, next).permission;
                    else if (
                        ts.isVariableDeclarationList(declaration.parent) &&
                        ts.isForOfStatement(declaration.parent.parent)
                    ) {
                        const iterable = source(
                            declaration.parent.parent.expression,
                            next,
                        );
                        mode =
                            child(iterable, "*")?.permission ??
                            (iterable.permission === 2 ? 2 : mode);
                    }
                } else if (
                    ts.isBindingElement(declaration) &&
                    ts.isVariableDeclaration(declaration.parent.parent)
                ) {
                    const variable = declaration.parent.parent;
                    if (
                        variable.initializer !== undefined &&
                        variable.type === undefined
                    ) {
                        const key = ts.isArrayBindingPattern(declaration.parent)
                            ? String(
                                  declaration.parent.elements.indexOf(
                                      declaration,
                                  ),
                              )
                            : (declaration.propertyName?.getText() ??
                              declaration.name.getText());
                        mode =
                            child(source(variable.initializer, next), key)
                                ?.permission ?? mode;
                    }
                }
            }
        }
        if (
            (ts.isPropertyAccessExpression(node) ||
                ts.isElementAccessExpression(node)) &&
            source(node.expression, [...seen, node]).permission === 2
        )
            mode = 2;
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression)
        ) {
            const declaration = checker.getResolvedSignature(node)?.declaration;
            if (
                ["get", "at", "values", "keys", "entries"].includes(
                    node.expression.name.text,
                ) &&
                declaration !== undefined &&
                program.isSourceFileDefaultLibrary(
                    declaration.getSourceFile(),
                ) &&
                source(node.expression.expression, [...seen, node])
                    .permission === 2
            )
                mode = 2;
        }
        const fresh =
            ts.isObjectLiteralExpression(node) ||
            ts.isArrayLiteralExpression(node) ||
            (ts.isNewExpression(node) && freshConstruction(node)) ||
            (ts.isCallExpression(node) && isStructuredClone(node));
        let deepFresh = isPrimitive(type);
        if (ts.isObjectLiteralExpression(node)) {
            deepFresh = node.properties.every((property) => {
                if (ts.isPropertyAssignment(property))
                    return grants(source(property.initializer), 2);
                if (ts.isShorthandPropertyAssignment(property))
                    return grants(source(property.name), 2);
                if (ts.isSpreadAssignment(property))
                    return grants(source(property.expression), 2);
                return false;
            });
        } else if (ts.isArrayLiteralExpression(node)) {
            deepFresh = node.elements.every(
                (element) =>
                    !ts.isOmittedExpression(element) &&
                    grants(
                        source(
                            ts.isSpreadElement(element)
                                ? element.expression
                                : element,
                        ),
                        2,
                    ),
            );
        } else if (ts.isCallExpression(node) && isStructuredClone(node)) {
            deepFresh = true;
        } else if (
            ts.isNewExpression(node) &&
            fresh &&
            (node.arguments?.length ?? 0) === 0
        ) {
            const declaration = checker.getResolvedSignature(node)?.declaration;
            deepFresh =
                declaration !== undefined &&
                program.isSourceFileDefaultLibrary(declaration.getSourceFile());
        }
        return { node, type, permission: mode, fresh, deepFresh };
    }

    function grants(value: Source, required: Permission): boolean {
        return (
            value.permission >= required ||
            (required === 1 && value.fresh) ||
            (required === 2 && value.deepFresh)
        );
    }

    function child(value: Source, key: string): Source | undefined {
        const { node } = value;
        if (node !== undefined && ts.isObjectLiteralExpression(node)) {
            for (const property of [...node.properties].reverse()) {
                if (ts.isSpreadAssignment(property)) {
                    const found = child(source(property.expression), key);
                    if (found !== undefined) return found;
                } else if (
                    property.name.getText().replace(/^['"]|['"]$/g, "") === key
                ) {
                    if (ts.isPropertyAssignment(property))
                        return source(property.initializer);
                    if (ts.isShorthandPropertyAssignment(property))
                        return source(property.name);
                }
            }
        }
        if (
            node !== undefined &&
            ts.isArrayLiteralExpression(node) &&
            key !== "*"
        ) {
            const element = node.elements[Number(key)];
            if (
                element !== undefined &&
                !ts.isOmittedExpression(element) &&
                !ts.isSpreadElement(element)
            )
                return source(element);
        }
        const location = node ?? value.type.getSymbol()?.declarations?.[0];
        if (location === undefined) return undefined;
        const type = propertyType(value.type, key, location);
        if (type === undefined) return undefined;
        return {
            node: undefined,
            type,
            permission: value.permission === 2 ? 2 : permission(type),
            fresh: false,
            deepFresh: isPrimitive(type),
        };
    }

    function isReference(type: ts.Type): type is ts.TypeReference {
        if (
            !hasFlag(type, ts.TypeFlags.Object) ||
            !("objectFlags" in type) ||
            typeof type.objectFlags !== "number"
        )
            return false;
        // eslint-disable-next-line no-bitwise -- TypeScript's Reference object flag identifies generic type arguments.
        return (type.objectFlags & ts.ObjectFlags.Reference) !== 0;
    }

    function dataArguments(type: ts.Type): readonly ts.Type[] {
        if (type.isIntersection()) {
            for (const part of type.types) {
                const arguments_ = dataArguments(part);
                if (arguments_.length > 0) return arguments_;
            }
            return [];
        }
        if (!isReference(type)) return [];
        const symbol = type.getSymbol();
        if (
            symbol === undefined ||
            ![
                "Map",
                "ReadonlyMap",
                "WeakMap",
                "Set",
                "ReadonlySet",
                "WeakSet",
                "Promise",
                "PromiseLike",
                "Iterable",
                "Iterator",
            ].includes(symbol.getName()) ||
            symbol.declarations?.some((declaration) =>
                program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
            ) !== true
        )
            return [];
        return checker.getTypeArguments(type);
    }

    const fileCache: Mut<Map<ts.SourceFile, boolean>> = new Map<
        ts.SourceFile,
        boolean
    >();

    // External type graphs can recursively instantiate without reaching a stable
    // Type identity. Only expand declaration files that can reference our grants.
    function fileMayContainGrants(file: ts.SourceFile): boolean {
        const cached = fileCache.get(file);
        if (cached !== undefined) return cached;
        const pending: Mut<ts.SourceFile[]> = [file];
        const visited: Mut<Set<ts.SourceFile>> = new Set<ts.SourceFile>();
        while (pending.length > 0) {
            const current = pending.pop();
            if (current === undefined || visited.has(current)) continue;
            if (
                current.fileName === MARKERS ||
                !current.isDeclarationFile ||
                fileCache.get(current) === true
            ) {
                fileCache.set(file, true);
                return true;
            }
            if (fileCache.get(current) === false) continue;
            visited.add(current);
            function visit(node: ts.Node): void {
                let specifier: ts.Node | undefined;
                if (
                    ts.isImportDeclaration(node) ||
                    ts.isExportDeclaration(node)
                )
                    specifier = node.moduleSpecifier;
                else if (
                    ts.isImportTypeNode(node) &&
                    ts.isLiteralTypeNode(node.argument)
                )
                    specifier = node.argument.literal;
                if (specifier !== undefined) {
                    const symbol = checker.getSymbolAtLocation(specifier);
                    const declarations = symbol?.declarations ?? [];
                    for (const declaration of declarations)
                        pending.push(declaration.getSourceFile());
                }
                ts.forEachChild(node, visit);
            }
            visit(current);
        }
        for (const current of visited) fileCache.set(current, false);
        return false;
    }

    const grantsCache: Mut<Map<ts.Type, boolean>> = new Map<ts.Type, boolean>();

    function hasGrants(type: ts.Type): boolean {
        const cached = grantsCache.get(type);
        if (cached !== undefined) return cached;
        const pending: Mut<ts.Type[]> = [type];
        const visited: Mut<Set<ts.Type>> = new Set<ts.Type>();
        while (pending.length > 0) {
            const current = pending.pop();
            if (current === undefined || visited.has(current)) continue;
            if (permission(current) > 0 || grantsCache.get(current) === true) {
                grantsCache.set(type, true);
                return true;
            }
            if (grantsCache.get(current) === false) continue;
            visited.add(current);
            if (current.isUnion()) pending.push(...current.types);
            for (const kind of [ts.IndexKind.Number, ts.IndexKind.String]) {
                const element = checker.getIndexTypeOfType(current, kind);
                if (element !== undefined) pending.push(element);
            }
            pending.push(...dataArguments(current));
            for (const property of current.getProperties()) {
                const declaration =
                    property.valueDeclaration ?? property.declarations?.[0];
                if (
                    declaration === undefined ||
                    program.isSourceFileDefaultLibrary(
                        declaration.getSourceFile(),
                    ) ||
                    !fileMayContainGrants(declaration.getSourceFile())
                )
                    continue;
                pending.push(
                    checker.getTypeOfSymbolAtLocation(property, declaration),
                );
            }
            for (const signature of current.getCallSignatures()) {
                for (const parameter of signature.parameters) {
                    if (parameter.valueDeclaration !== undefined)
                        pending.push(
                            checker.getTypeOfSymbolAtLocation(
                                parameter,
                                parameter.valueDeclaration,
                            ),
                        );
                }
                pending.push(checker.getReturnTypeOfSignature(signature));
            }
        }
        for (const current of visited) grantsCache.set(current, false);
        return false;
    }

    // The target's nested grants are obligations, even when its root is readonly.
    function permits(
        value: Source,
        target: ts.Type,
        seen: readonly Visit[] = [],
    ): boolean {
        if (!hasGrants(target) && !hasGrants(value.type)) return true;
        if (target.isUnion()) {
            if (value.type.isUnion())
                return value.type.types.every((part) =>
                    permits(
                        { ...value, type: part, permission: permission(part) },
                        target,
                        seen,
                    ),
                );
            const applicable = target.types.filter((part) =>
                checker.isTypeAssignableTo(value.type, part),
            );
            return (
                applicable.length > 0 &&
                applicable.some((part) => permits(value, part, seen))
            );
        }
        if (!grants(value, permission(target))) return false;
        if (
            seen.some(
                (visit) =>
                    visit.type === value.type &&
                    visit.target === target &&
                    visit.permission === value.permission &&
                    visit.node === value.node,
            )
        )
            return true;
        const next = [
            ...seen,
            {
                type: value.type,
                target,
                permission: value.permission,
                node: value.node,
            },
        ];
        const wantedArguments = dataArguments(target);
        const actualArguments = dataArguments(value.type);
        for (const [index, expected] of wantedArguments.entries()) {
            const actualType = actualArguments[index];
            if (actualType === undefined) continue;
            const argumentSource: Source = {
                node: undefined,
                type: actualType,
                permission: value.permission === 2 ? 2 : permission(actualType),
                fresh: false,
                deepFresh: isPrimitive(actualType),
            };
            if (!permits(argumentSource, expected, next)) return false;
        }
        // A mutating function cannot be hidden behind a readonly callback signature.
        const wanted = target.getCallSignatures();
        const actual = value.type.getCallSignatures();
        for (const signature of actual) {
            for (const expected of wanted) {
                const actualReturn =
                    checker.getReturnTypeOfSignature(signature);
                const expectedReturn =
                    checker.getReturnTypeOfSignature(expected);
                const returnedSource: Source = {
                    node: undefined,
                    type: actualReturn,
                    permission: permission(actualReturn),
                    fresh: false,
                    deepFresh: isPrimitive(actualReturn),
                };
                if (!permits(returnedSource, expectedReturn, next))
                    return false;
                for (const [
                    index,
                    parameter,
                ] of signature.parameters.entries()) {
                    const location = parameter.valueDeclaration;
                    const allowed = expected.parameters[index];
                    if (location === undefined || allowed === undefined)
                        continue;
                    const actualType = checker.getTypeOfSymbolAtLocation(
                        parameter,
                        location,
                    );
                    const expectedType = checker.getTypeOfSymbolAtLocation(
                        allowed,
                        location,
                    );
                    const expectedSource: Source = {
                        node: undefined,
                        type: expectedType,
                        permission: permission(expectedType),
                        fresh: false,
                        deepFresh: isPrimitive(expectedType),
                    };
                    if (!permits(expectedSource, actualType, next))
                        return false;
                }
            }
        }
        for (const property of target.getProperties()) {
            const declaration =
                property.valueDeclaration ?? property.declarations?.[0];
            if (
                declaration === undefined ||
                property.declarations?.some(
                    (declaration) =>
                        declaration.getSourceFile().fileName === MARKERS,
                ) === true
            )
                continue;
            // Builtin methods contain huge recursive callable types, not field grants.
            if (program.isSourceFileDefaultLibrary(declaration.getSourceFile()))
                continue;
            const actualChild = child(value, property.getName());
            if (
                actualChild !== undefined &&
                !permits(
                    actualChild,
                    checker.getTypeOfSymbolAtLocation(property, declaration),
                    next,
                )
            )
                return false;
        }
        const stringElement = checker.getIndexTypeOfType(
            target,
            ts.IndexKind.String,
        );
        if (stringElement !== undefined) {
            const entry = child(value, "**");
            if (entry !== undefined && !permits(entry, stringElement, next))
                return false;
        }
        const element = checker.getIndexTypeOfType(target, ts.IndexKind.Number);
        if (element !== undefined) {
            if (
                value.node !== undefined &&
                ts.isArrayLiteralExpression(value.node)
            ) {
                for (const item of value.node.elements) {
                    if (ts.isOmittedExpression(item)) continue;
                    if (ts.isSpreadElement(item)) {
                        const entry = child(source(item.expression), "*");
                        if (
                            entry !== undefined &&
                            !permits(entry, element, next)
                        )
                            return false;
                    } else if (!permits(source(item), element, next))
                        return false;
                }
            } else {
                const entry = child(value, "*");
                if (entry !== undefined && !permits(entry, element, next))
                    return false;
            }
        }
        return true;
    }

    function permitsFields(value: Source, target: ts.Type): boolean {
        for (const property of target.getProperties()) {
            const declaration =
                property.valueDeclaration ?? property.declarations?.[0];
            if (
                declaration === undefined ||
                property.declarations?.some(
                    (declaration) =>
                        declaration.getSourceFile().fileName === MARKERS,
                ) === true
            )
                continue;
            const actual = child(value, property.getName());
            if (
                actual !== undefined &&
                !permits(
                    actual,
                    checker.getTypeOfSymbolAtLocation(property, declaration),
                )
            )
                return false;
        }
        return true;
    }

    return { permission, source, child, permits, permitsFields, grants };
}
