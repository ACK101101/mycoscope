import { ESLintUtils } from "@typescript-eslint/utils";
import { effectOverrides } from "../src/effects/directives.ts";

const createRule = ESLintUtils.RuleCreator((name) => `mycoscope/${name}`);
export const effectSuppressions = createRule({
    name: "effect-suppressions",
    meta: {
        type: "problem",
        docs: {
            description:
                "Effect diagnostic overrides must be comments with reviewable reasons.",
        },
        schema: [],
        messages: {
            reason: "Effect overrides must be comments with a reason after ` -- `. Upstream also interprets overrides hidden in literals.",
        },
    },
    defaultOptions: [],
    create(context) {
        return {
            Program(): void {
                const source = context.sourceCode;
                const comments = source.getAllComments();
                for (const override of effectOverrides(source.text)) {
                    const comment = comments.find(
                        (candidate) =>
                            candidate.range[0] <= override.index &&
                            candidate.range[1] >=
                                override.index + override.length,
                    );
                    const reason = override.rest
                        .split(" -- ")
                        .slice(1)
                        .join(" -- ")
                        .replace(/\*\/\s*$/, "")
                        .trim();
                    if (comment === undefined || reason.length === 0)
                        context.report({
                            loc: source.getLocFromIndex(override.index),
                            messageId: "reason",
                        });
                }
            },
        };
    },
});
