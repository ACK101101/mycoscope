import {
    ASTUtils,
    AST_NODE_TYPES,
    ESLintUtils,
    TSESLint,
    type TSESTree,
} from "@typescript-eslint/utils";
import ts from "typescript";
import { builtinMutation } from "./builtin-mutation.ts";
import { createPermissions } from "./permissions.ts";

// Permission follows the reference: Mut is shallow, MutDeep includes descendants.
// Origin tracing below is diagnostic context for unmarked references, not an
// ownership grant. The shared analysis recognizes canonical marker symbols.

type Scope = TSESLint.Scope.Scope;
type Variable = TSESLint.Scope.Variable;
type ScopeOf = (node: TSESTree.Node) => Scope;

const { DefinitionType, ScopeType } = TSESLint.Scope;

const FRESH_NODES = new Set<AST_NODE_TYPES>([
    AST_NODE_TYPES.ArrayExpression,
    AST_NODE_TYPES.ObjectExpression,
    AST_NODE_TYPES.NewExpression,
]);

function rootOf(node: TSESTree.Node): TSESTree.Node {
    if (node.type === AST_NODE_TYPES.MemberExpression)
        return rootOf(node.object);
    if (node.type === AST_NODE_TYPES.ChainExpression)
        return rootOf(node.expression);
    return node;
}

function inConstructor(node: TSESTree.Node | undefined): boolean {
    if (node === undefined) return false;
    // Arrow functions inherit `this`, so keep walking out of them.
    if (
        node.type === AST_NODE_TYPES.FunctionExpression ||
        node.type === AST_NODE_TYPES.FunctionDeclaration
    ) {
        return (
            node.parent.type === AST_NODE_TYPES.MethodDefinition &&
            node.parent.kind === "constructor"
        );
    }
    return inConstructor(node.parent);
}

// The one trusted call: the deep copy. A local or import that shadows the name is not it.
function isGlobalStructuredClone(
    call: TSESTree.CallExpression,
    scopeOf: ScopeOf,
): boolean {
    const { callee } = call;
    if (
        callee.type !== AST_NODE_TYPES.Identifier ||
        callee.name !== "structuredClone"
    ) {
        return false;
    }
    const variable = ASTUtils.findVariable(scopeOf(callee), callee);
    return variable === null || variable.defs.length === 0;
}

function isFresh(
    expr: TSESTree.Node,
    scopeOf: ScopeOf,
    seen: readonly Variable[],
): boolean {
    if (FRESH_NODES.has(expr.type)) return true;
    if (
        expr.type === AST_NODE_TYPES.TSAsExpression ||
        expr.type === AST_NODE_TYPES.TSSatisfiesExpression
    ) {
        return isFresh(expr.expression, scopeOf, seen);
    }
    if (expr.type === AST_NODE_TYPES.ConditionalExpression) {
        return (
            isFresh(expr.consequent, scopeOf, seen) &&
            isFresh(expr.alternate, scopeOf, seen)
        );
    }
    if (expr.type === AST_NODE_TYPES.CallExpression) {
        return isGlobalStructuredClone(expr, scopeOf);
    }
    if (expr.type === AST_NODE_TYPES.Identifier) {
        // An alias of another owned local is still memory this function owns.
        const variable = ASTUtils.findVariable(scopeOf(expr), expr);
        return (
            variable !== null &&
            whyNotOwned(variable, scopeOf, seen) === undefined
        );
    }
    return false;
}

// Returns why the variable's memory is not this function's, or undefined if it is.
function whyNotOwned(
    variable: Variable,
    scopeOf: ScopeOf,
    seen: readonly Variable[],
): string | undefined {
    const { name } = variable;
    const def = variable.defs[0];
    if (def === undefined) return `'${name}' is a global`;
    if (def.type === DefinitionType.Parameter) {
        return `'${name}' is a parameter, so it belongs to the caller`;
    }
    if (def.type === DefinitionType.ImportBinding)
        return `'${name}' is imported`;
    if (def.type !== DefinitionType.Variable) {
        return `'${name}' was not created in this function`;
    }
    if (variable.scope.variableScope.type !== ScopeType.function) {
        return `'${name}' is module-level state`;
    }
    if (def.node.id.type !== AST_NODE_TYPES.Identifier) {
        return `'${name}' is destructured out of another value`;
    }
    if (seen.includes(variable)) return undefined; // a = b; b = a
    const writes = variable.references.filter((r) => r.isWrite());
    if (writes.length === 0) return `'${name}' is never given a value here`;
    const alias = writes.some(
        (r) =>
            r.writeExpr !== undefined &&
            r.writeExpr !== null &&
            !isFresh(r.writeExpr, scopeOf, [...seen, variable]),
    );
    return alias
        ? `'${name}' may alias memory this function did not create`
        : undefined;
}

function whyForeign(root: TSESTree.Node, scopeOf: ScopeOf): string | undefined {
    if (root.type === AST_NODE_TYPES.ThisExpression) {
        return inConstructor(root)
            ? undefined
            : "'this' state belongs to the class instance";
    }
    if (root.type !== AST_NODE_TYPES.Identifier) {
        // `Object.assign({}, x)` mutates a literal made on the spot.
        return isFresh(root, scopeOf, [])
            ? undefined
            : "its origin cannot be traced";
    }
    const variable = ASTUtils.findVariable(scopeOf(root), root);
    return variable === null
        ? `'${root.name}' is a global`
        : whyNotOwned(variable, scopeOf, []);
}

const isAccess = (
    node: TSESTree.Node,
): node is TSESTree.MemberExpression | TSESTree.ChainExpression =>
    node.type === AST_NODE_TYPES.MemberExpression ||
    node.type === AST_NODE_TYPES.ChainExpression;

const createRule = ESLintUtils.RuleCreator((name) => `mycoscope/${name}`);

export const noForeignMutation = createRule({
    name: "no-foreign-mutation",
    meta: {
        type: "problem",
        docs: {
            description:
                "Only mutate references with explicit shallow or deep permission.",
        },
        schema: [],
        messages: {
            foreign:
                "Mutating `{{target}}`: {{why}}. Copy it first (`const next = [...x]`) and mutate the copy, or return a new value.",
        },
    },
    defaultOptions: [],
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();
        const permissions = createPermissions(services.program);
        const scopeOf: ScopeOf = (n) => context.sourceCode.getScope(n);

        const check = (
            node: TSESTree.Node,
            target: TSESTree.Node,
            receiver: TSESTree.Node = target,
        ): void => {
            if (
                receiver.type === AST_NODE_TYPES.ThisExpression &&
                inConstructor(receiver)
            )
                return;
            const tsReceiver = services.esTreeNodeToTSNodeMap.get(receiver);
            if (!ts.isExpression(tsReceiver)) return;
            const value = permissions.source(tsReceiver);
            if (value.permission > 0 || value.fresh) return;
            const root = rootOf(target);
            const why =
                whyForeign(root, scopeOf) ??
                "this reference has no Mut or MutDeep permission";
            context.report({
                node,
                messageId: "foreign",
                data: { target: context.sourceCode.getText(target), why },
            });
        };

        return {
            AssignmentExpression: (node): void => {
                if (isAccess(node.left))
                    check(
                        node,
                        node.left,
                        node.left.type === AST_NODE_TYPES.MemberExpression
                            ? node.left.object
                            : node.left,
                    );
            },
            UpdateExpression: (node): void => {
                if (isAccess(node.argument))
                    check(
                        node,
                        node.argument,
                        node.argument.type === AST_NODE_TYPES.MemberExpression
                            ? node.argument.object
                            : node.argument,
                    );
            },
            UnaryExpression: (node): void => {
                if (node.operator === "delete" && isAccess(node.argument)) {
                    check(
                        node,
                        node.argument,
                        node.argument.type === AST_NODE_TYPES.MemberExpression
                            ? node.argument.object
                            : node.argument,
                    );
                }
            },
            CallExpression: (node): void => {
                const call = services.esTreeNodeToTSNodeMap.get(node);
                const mutation = builtinMutation(
                    call,
                    checker,
                    services.program,
                );
                if (mutation === undefined) return;
                const target = services.tsNodeToESTreeNodeMap.get(
                    mutation.target,
                );
                if (mutation.binds) {
                    context.report({
                        node,
                        messageId: "foreign",
                        data: {
                            target: context.sourceCode.getText(target),
                            why: "binding a builtin mutator hides its later mutation target",
                        },
                    });
                } else check(node, target);
            },
        };
    },
});
