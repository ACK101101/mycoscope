import { testLintRule } from "../../harness/lint-adapter.ts";

testLintRule("@typescript-eslint/ban-ts-comment", [
    {
        name: "ts-ignore is reported",
        code: '// @ts-ignore\nexport const n: number = "a";\n',
        expect: [
            {
                id: "@typescript-eslint/ban-ts-comment",
                severity: 2,
                line: 1,
                column: 1,
                text: "// @ts-ignore",
                message:
                    'Use "@ts-expect-error" instead of "@ts-ignore", as "@ts-ignore" will do nothing if the following line is error-free.',
            },
        ],
    },
    {
        name: "ts-expect-error without a description is reported",
        code: '// @ts-expect-error\nexport const n: number = "a";\n',
        expect: [
            {
                id: "@typescript-eslint/ban-ts-comment",
                severity: 2,
                line: 1,
                column: 1,
                text: "// @ts-expect-error",
                message:
                    'Include a description after the "@ts-expect-error" directive to explain why the @ts-expect-error is necessary. The description must be 3 characters or longer.',
            },
        ],
    },
    {
        name: "ts-nocheck is reported",
        code: "// @ts-nocheck\nexport const n: number = 1;\n",
        expect: [
            {
                id: "@typescript-eslint/ban-ts-comment",
                severity: 2,
                line: 1,
                column: 1,
                text: "// @ts-nocheck",
                message:
                    'Do not use "@ts-nocheck" because it alters compilation errors.',
            },
        ],
    },
    {
        name: "ts-check is reported",
        code: "// @ts-check\nexport const n: number = 1;\n",
        expect: [
            {
                id: "@typescript-eslint/ban-ts-comment",
                severity: 2,
                line: 1,
                column: 1,
                text: "// @ts-check",
                message:
                    'Do not use "@ts-check" because it alters compilation errors.',
            },
        ],
    },
    {
        name: "a typed function is allowed",
        code: "export function f(x: number): number {\n    return x + 1;\n}\n",
        expect: [],
    },
]);
