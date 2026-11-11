import {
    AST_NODE_TYPES,
    ESLintUtils,
    type TSESTree,
} from "@typescript-eslint/utils";
import ts from "typescript";
import { builtinMutation } from "./builtin-mutation.ts";
import { createPermissions } from "./permissions.ts";

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
                "Mutation of `{{target}}` requires Mut or MutDeep permission.",
            boundMutator:
                "Call builtin mutators with an explicit receiver instead of binding them.",
        },
    },
    defaultOptions: [],
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();
        const permissions = createPermissions(services.program);

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
            context.report({
                node,
                messageId: "foreign",
                data: { target: context.sourceCode.getText(target) },
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
                        messageId: "boundMutator",
                    });
                } else check(node, target);
            },
        };
    },
});
