import {
    AST_NODE_TYPES,
    ESLintUtils,
    type TSESTree,
} from "@typescript-eslint/utils";
import ts from "typescript";
import { builtinMutation } from "./builtin-mutation.ts";
import { createPermissions } from "./permissions.ts";

const createRule = ESLintUtils.RuleCreator((name) => `mycoscope/${name}`);

export const noPermissionEscalation = createRule({
    name: "no-permission-escalation",
    meta: {
        type: "problem",
        docs: {
            description:
                "Mutation permissions must be supplied, never manufactured by a type annotation.",
        },
        schema: [],
        messages: {
            escalation:
                "This value does not supply the mutation permissions required here. Pass an authorized reference or construct fresh data.",
        },
    },
    defaultOptions: [],
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();
        const permissions = createPermissions(services.program);

        function check(node: TSESTree.Node, target: ts.Type): void {
            const expression = services.esTreeNodeToTSNodeMap.get(node);
            if (!ts.isExpression(expression)) return;
            if (!permissions.permits(permissions.source(expression), target)) {
                context.report({ node, messageId: "escalation" });
            }
        }

        function checkReturn(
            expression: TSESTree.Expression,
            fn: TSESTree.Node,
        ): void {
            const declaration = services.esTreeNodeToTSNodeMap.get(fn);
            if (!ts.isFunctionLike(declaration)) return;
            const signature = checker.getSignatureFromDeclaration(declaration);
            if (signature === undefined) return;
            const returned = checker.getReturnTypeOfSignature(signature);
            const async =
                ts.canHaveModifiers(declaration) &&
                ts
                    .getModifiers(declaration)
                    ?.some(
                        (modifier) =>
                            modifier.kind === ts.SyntaxKind.AsyncKeyword,
                    ) === true;
            check(
                expression,
                async
                    ? (checker.getAwaitedType(returned) ?? returned)
                    : returned,
            );
            if (declaration.name !== undefined) {
                const symbol = checker.getSymbolAtLocation(declaration.name);
                const declarations = symbol?.declarations ?? [];
                for (const overload of declarations) {
                    if (
                        overload === declaration ||
                        !ts.isFunctionDeclaration(overload) ||
                        overload.body !== undefined
                    )
                        continue;
                    const overloadSignature =
                        checker.getSignatureFromDeclaration(overload);
                    if (overloadSignature !== undefined) {
                        const returned =
                            checker.getReturnTypeOfSignature(overloadSignature);
                        check(
                            expression,
                            async
                                ? (checker.getAwaitedType(returned) ?? returned)
                                : returned,
                        );
                    }
                }
            }
        }

        function isTuple(type: ts.Type): type is ts.TupleTypeReference {
            return checker.isTupleType(type);
        }

        function checkCall(
            node: TSESTree.CallExpression | TSESTree.NewExpression,
        ): void {
            const call = services.esTreeNodeToTSNodeMap.get(node);
            const signature = checker.getResolvedSignature(call);
            if (signature === undefined) return;
            const thisParameter = signature.thisParameter;
            if (
                thisParameter !== undefined &&
                node.callee.type === AST_NODE_TYPES.MemberExpression
            ) {
                check(
                    node.callee.object,
                    checker.getTypeOfSymbolAtLocation(thisParameter, call),
                );
            }
            for (const [index, argument] of node.arguments.entries()) {
                const parameter =
                    signature.parameters[index] ?? signature.parameters.at(-1);
                if (parameter === undefined) continue;
                const declaration = parameter.valueDeclaration;
                if (declaration === undefined) continue;
                let target = checker.getTypeOfSymbolAtLocation(parameter, call);
                if (
                    ts.isParameter(declaration) &&
                    declaration.dotDotDotToken !== undefined
                ) {
                    target =
                        checker.getIndexTypeOfType(
                            target,
                            ts.IndexKind.Number,
                        ) ?? target;
                } else if (index >= signature.parameters.length) continue;
                if (argument.type === AST_NODE_TYPES.SpreadElement) {
                    const spread = services.esTreeNodeToTSNodeMap.get(
                        argument.argument,
                    );
                    if (!ts.isExpression(spread)) continue;
                    const value = permissions.source(spread);
                    const remaining = signature.parameters.slice(index);
                    const missing = remaining.some((restParameter, offset) => {
                        let restType = checker.getTypeOfSymbolAtLocation(
                            restParameter,
                            call,
                        );
                        const restDeclaration = restParameter.valueDeclaration;
                        if (
                            restDeclaration !== undefined &&
                            ts.isParameter(restDeclaration) &&
                            restDeclaration.dotDotDotToken !== undefined
                        )
                            restType =
                                checker.getIndexTypeOfType(
                                    restType,
                                    ts.IndexKind.Number,
                                ) ?? restType;
                        if (
                            restDeclaration !== undefined &&
                            ts.isParameter(restDeclaration) &&
                            restDeclaration.dotDotDotToken !== undefined &&
                            value.node !== undefined &&
                            ts.isArrayLiteralExpression(value.node)
                        ) {
                            return value.node.elements.some(
                                (item) =>
                                    !ts.isOmittedExpression(item) &&
                                    !permissions.permits(
                                        permissions.source(
                                            ts.isSpreadElement(item)
                                                ? item.expression
                                                : item,
                                        ),
                                        restType,
                                    ),
                            );
                        }
                        const valueType = value.type;
                        if (
                            restDeclaration !== undefined &&
                            ts.isParameter(restDeclaration) &&
                            restDeclaration.dotDotDotToken !== undefined &&
                            isTuple(valueType)
                        ) {
                            return checker
                                .getTypeArguments(valueType)
                                .some((_entry, entryIndex) => {
                                    const entry = permissions.child(
                                        value,
                                        String(entryIndex),
                                    );
                                    return (
                                        entry !== undefined &&
                                        !permissions.permits(entry, restType)
                                    );
                                });
                        }
                        const key = checker.isTupleType(value.type)
                            ? String(offset)
                            : "*";
                        const entry = permissions.child(value, key);
                        return (
                            entry !== undefined &&
                            !permissions.permits(entry, restType)
                        );
                    });
                    if (missing)
                        context.report({
                            node: argument,
                            messageId: "escalation",
                        });
                } else check(argument, target);
            }
            if (node.type === AST_NODE_TYPES.CallExpression) {
                const nativeCall = services.esTreeNodeToTSNodeMap.get(node);
                const mutation = builtinMutation(
                    nativeCall,
                    checker,
                    services.program,
                );
                if (mutation !== undefined) {
                    const receiver = permissions.source(mutation.target);
                    for (const argument of mutation.stored) {
                        const value = permissions.source(argument);
                        const allowed =
                            receiver.permission === 2
                                ? permissions.grants(value, 2)
                                : mutation.name !== "assign" ||
                                  permissions.permitsFields(
                                      value,
                                      receiver.type,
                                  );
                        if (!allowed)
                            context.report({
                                node: services.tsNodeToESTreeNodeMap.get(
                                    argument,
                                ),
                                messageId: "escalation",
                            });
                    }
                }
            }
        }

        return {
            VariableDeclarator(node): void {
                if (node.init === null) return;
                check(node.init, services.getTypeAtLocation(node.id));
            },
            AssignmentExpression(node): void {
                if (node.operator !== "=") return;
                check(node.right, services.getTypeAtLocation(node.left));
                const left = services.esTreeNodeToTSNodeMap.get(node.left);
                const right = services.esTreeNodeToTSNodeMap.get(node.right);
                if (ts.isExpression(left) && ts.isExpression(right)) {
                    const inherited = permissions.source(left).permission;
                    const declared = permissions.permission(
                        checker.getTypeAtLocation(left),
                    );
                    if (
                        inherited > declared &&
                        !permissions.grants(
                            permissions.source(right),
                            inherited,
                        )
                    )
                        context.report({
                            node: node.right,
                            messageId: "escalation",
                        });
                }
            },
            AssignmentPattern(node): void {
                check(node.right, services.getTypeAtLocation(node.left));
            },
            PropertyDefinition(node): void {
                if (node.value !== null)
                    check(node.value, services.getTypeAtLocation(node));
            },
            ReturnStatement(node): void {
                if (node.argument === null) return;
                let parent = node.parent;
                while (
                    parent.type !== AST_NODE_TYPES.FunctionDeclaration &&
                    parent.type !== AST_NODE_TYPES.FunctionExpression &&
                    parent.type !== AST_NODE_TYPES.ArrowFunctionExpression
                ) {
                    if (parent.parent === undefined) return;
                    parent = parent.parent;
                }
                checkReturn(node.argument, parent);
            },
            ArrowFunctionExpression(node): void {
                if (node.body.type !== AST_NODE_TYPES.BlockStatement)
                    checkReturn(node.body, node);
            },
            CallExpression: checkCall,
            NewExpression: checkCall,
        };
    },
});
