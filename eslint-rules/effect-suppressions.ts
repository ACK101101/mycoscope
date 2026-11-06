import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator((name) => `mycoscope/${name}`);

export const effectSuppressions = createRule({
    name: "effect-suppressions",
    meta: {
        type: "problem",
        docs: {
            description:
                "Effect diagnostic suppressions require a reviewable reason.",
        },
        schema: [],
        messages: {
            reason: "Add a reason after ` -- ` to this Effect suppression.",
        },
    },
    defaultOptions: [],
    create(context) {
        return {
            Program(): void {
                for (const comment of context.sourceCode.getAllComments()) {
                    if (!/^\s*@effect-diagnostics\b/.test(comment.value))
                        continue;
                    const reason = comment.value
                        .split(" -- ")
                        .slice(1)
                        .join(" -- ")
                        .trim();
                    if (reason.length === 0)
                        context.report({
                            loc: comment.loc,
                            messageId: "reason",
                        });
                }
            },
        };
    },
});
