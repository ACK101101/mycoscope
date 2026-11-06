import { tscOption } from "../harness/tsc.ts";

tscOption("noImplicitAny", [
    {
        name: "an untyped parameter is implicitly any",
        code: "export function id(x) {\n    return x;\n}\n",
        expect: [
            {
                id: "TS7006",
                line: 1,
                column: 20,
                text: "x",
                message: "Parameter 'x' implicitly has an 'any' type.",
            },
        ],
    },
    {
        name: "each untyped parameter is reported, in source order",
        code: "export function pair(a, b) {\n    return [a, b];\n}\n",
        expect: [
            { id: "TS7006", line: 1, column: 22, text: "a" },
            { id: "TS7006", line: 1, column: 25, text: "b" },
        ],
    },
    {
        name: "an untyped destructured parameter is reported per binding",
        code: "export function name({ first }) {\n    return first;\n}\n",
        expect: [
            {
                id: "TS7031",
                line: 1,
                column: 24,
                text: "first",
                message:
                    "Binding element 'first' implicitly has an 'any' type.",
            },
        ],
    },
    {
        name: "an annotated parameter is fine",
        code: "export function id(x: number): number {\n    return x;\n}\n",
        expect: [],
    },
    {
        name: "an explicit any is allowed: the option bans implicit any only",
        code: "export function id(x: any): any {\n    return x;\n}\n",
        expect: [],
    },
]);
