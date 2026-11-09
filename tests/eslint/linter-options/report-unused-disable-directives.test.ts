import { testUnusedDisableDirectives } from "../../harness/lint-adapter.ts";

testUnusedDisableDirectives([
    {
        name: "a directive that suppresses no diagnostic is reported",
        code: "export function f(x: string): string {\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- nothing here to suppress\n    return x;\n}\n",
        expect: [
            {
                id: "(no rule)",
                severity: 2,
                line: 2,
                column: 5,
                text: "",
                message:
                    "Unused eslint-disable directive (no problems were reported from '@typescript-eslint/consistent-type-assertions').",
            },
        ],
    },
    {
        name: "a directive that suppresses an assertion is allowed",
        code: "export function f(x: unknown): string {\n    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixture: reasoned disable is allowed\n    return x as string;\n}\n",
        expect: [],
    },
    {
        name: "source without disable directives is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
