import { tscOption } from "../harness/tsc.ts";

// Only acts together with strictNullChecks, so both come from the real tsconfig.
tscOption(
    "strictPropertyInitialization",
    [
        {
            name: "a field that is never assigned is reported",
            code: "export class Box {\n    value: string;\n}\n",
            expect: [
                {
                    id: "TS2564",
                    line: 2,
                    column: 5,
                    text: "value",
                    message:
                        "Property 'value' has no initializer and is not definitely assigned in the constructor.",
                },
            ],
        },
        {
            name: "a field assigned in the constructor is fine",
            code: "export class Box {\n    value: string;\n    constructor(value: string) {\n        this.value = value;\n    }\n}\n",
            expect: [],
        },
        {
            name: "a field with an initializer is fine",
            code: 'export class Box {\n    value = "";\n}\n',
            expect: [],
        },
    ],
    ["strictNullChecks"],
);
