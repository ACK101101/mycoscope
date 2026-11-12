import { test } from "node:test";
import { compileWithOption } from "../../harness/tsc-adapter.ts";
import { assertDiagnosticsMatch } from "../../harness/diagnostics.ts";

// strictPropertyInitialization requires strictNullChecks. Read both from tsconfig.json.
void test("a field that is never assigned is reported", () => {
    const diagnostics = compileWithOption(
        "strictPropertyInitialization",
        "export class Box {\n    value: string;\n}\n",
        ["strictNullChecks"],
    );
    assertDiagnosticsMatch(diagnostics, [
        {
            id: "TS2564",
            line: 2,
            column: 5,
            text: "value",
            message:
                "Property 'value' has no initializer and is not definitely assigned in the constructor.",
        },
    ]);
});

void test("a field assigned in the constructor is fine", () => {
    const diagnostics = compileWithOption(
        "strictPropertyInitialization",
        "export class Box {\n    value: string;\n    constructor(value: string) {\n        this.value = value;\n    }\n}\n",
        ["strictNullChecks"],
    );
    assertDiagnosticsMatch(diagnostics, []);
});

void test("a field with an initializer is fine", () => {
    const diagnostics = compileWithOption(
        "strictPropertyInitialization",
        'export class Box {\n    value = "";\n}\n',
        ["strictNullChecks"],
    );
    assertDiagnosticsMatch(diagnostics, []);
});
