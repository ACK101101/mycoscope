import { effectSuppressions } from "./effect-suppressions.ts";
import { noPermissionEscalation } from "./no-permission-escalation.ts";
import { noForeignMutation } from "./no-foreign-mutation.ts";

// Local ESLint plugin. Registered in eslint.config.js as `mycoscope`.
export default {
    rules: {
        "effect-suppressions": effectSuppressions,
        "no-foreign-mutation": noForeignMutation,
        "no-permission-escalation": noPermissionEscalation,
    },
};
