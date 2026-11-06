import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { ESLint } from "eslint";
import ts from "typescript";

function registeredRules(text: string): readonly string[] {
    const source = ts.createSourceFile(
        "test.ts",
        text,
        ts.ScriptTarget.Latest,
        true,
    );
    const constants: Map<string, string> = new Map<string, string>();
    const found: Set<string> = new Set<string>();
    function visit(node: ts.Node): void {
        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.initializer !== undefined &&
            ts.isStringLiteral(node.initializer)
        )
            constants.set(node.name.text, node.initializer.text);
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            ["lintRule", "lintExamples", "lintParserExamples"].includes(
                node.expression.text,
            )
        ) {
            const argument = node.arguments[0];
            let name: string | undefined;
            if (argument !== undefined && ts.isStringLiteral(argument))
                name = argument.text;
            else if (argument !== undefined && ts.isIdentifier(argument))
                name = constants.get(argument.text);
            const examples = node.arguments[1];
            if (
                node.expression.text === "lintRule" &&
                (examples === undefined ||
                    !ts.isArrayLiteralExpression(examples) ||
                    examples.elements.length === 0)
            )
                return;
            if (name !== undefined) found.add(name);
        }
        // The legacy fixture suite registers its cases by ruleId.
        if (
            ts.isPropertyAssignment(node) &&
            node.name.getText(source) === "ruleId" &&
            ts.isStringLiteral(node.initializer)
        )
            found.add(node.initializer.text);
        ts.forEachChild(node, visit);
    }
    visit(source);
    return [...found];
}

function missingTests(
    rules: Readonly<Record<string, readonly unknown[]>>,
    registered: readonly string[],
): readonly string[] {
    return Object.entries(rules)
        .filter(
            ([name, setting]) =>
                setting[0] !== 0 &&
                setting[0] !== "off" &&
                !registered.includes(name),
        )
        .map(([name]) => name)
        .toSorted();
}

void test("every effective enabled rule, including presets, has a registered behavior test", async () => {
    const files = [
        "tests/rules.test.ts",
        ...(await readdir("tests/rules"))
            .filter((file) => file.endsWith(".test.ts"))
            .map((file) => `tests/rules/${file}`),
    ];
    const registered = (
        await Promise.all(
            files.map(async (file) =>
                registeredRules(await readFile(file, "utf8")),
            ),
        )
    ).flat();
    const engine = new ESLint();
    const config: unknown = await engine.calculateConfigForFile("src/index.ts");
    assert.ok(
        typeof config === "object" && config !== null && "rules" in config,
    );
    assert.ok(typeof config.rules === "object" && config.rules !== null);
    const rules = Object.fromEntries(
        Object.entries(config.rules).map(
            ([name, setting]: [string, unknown]) => {
                assert.ok(Array.isArray(setting));
                const values: readonly unknown[] = setting;
                return [name, values];
            },
        ),
    );
    assert.deepEqual(
        missingTests(rules, registered),
        [],
        "Enabled rules without tests",
    );
});

void test("enabling an untested rule fails coverage while disabled rules do not", () => {
    assert.deepEqual(
        missingTests(
            { tested: [2], newRule: [2], disabled: [0], alsoDisabled: ["off"] },
            ["tested"],
        ),
        ["newRule"],
    );
});

void test("a test filename or an unrelated rule string is not a registration", () => {
    assert.deepEqual(registeredRules('const rule = "no-debugger";'), []);
    assert.deepEqual(
        registeredRules('const RULE = "no-debugger"; lintRule(RULE, []);'),
        [],
    );
    assert.deepEqual(
        registeredRules(
            'const RULE = "no-debugger"; lintRule(RULE, [{ code: "debugger;" }]);',
        ),
        ["no-debugger"],
    );
});
