import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { EFFECT_DIAGNOSTIC_CASES } from "./diagnostic-cases.ts";

async function readDiagnosticSeverities(): Promise<object> {
    const text = await readFile(
        new URL("../../tsconfig.effect-settings.json", import.meta.url),
        "utf8",
    );
    const configured: unknown = JSON.parse(text);
    assert.ok(
        typeof configured === "object" &&
            configured !== null &&
            "compilerOptions" in configured,
    );
    const options = configured.compilerOptions;
    assert.ok(
        typeof options === "object" &&
            options !== null &&
            "plugins" in options &&
            Array.isArray(options.plugins),
    );
    const plugin: unknown = options.plugins[0];
    assert.ok(
        typeof plugin === "object" &&
            plugin !== null &&
            "diagnosticSeverity" in plugin,
    );
    const severities = plugin.diagnosticSeverity;
    assert.ok(typeof severities === "object" && severities !== null);
    return severities;
}

void test("every enabled upstream Effect diagnostic has a behavior case", async () => {
    const severities = await readDiagnosticSeverities();
    assert.deepEqual(
        Object.entries(severities)
            .filter(([, severity]) => severity !== "off")
            .map(([name]) => name)
            .toSorted(),
        EFFECT_DIAGNOSTIC_CASES.map((example) => example.name).toSorted(),
    );
});

void test("every installed upstream diagnostic has an explicit severity decision", async () => {
    const schema: unknown = JSON.parse(
        await readFile(
            new URL(
                "../../node_modules/@effect/language-service/schema.json",
                import.meta.url,
            ),
            "utf8",
        ),
    );
    assert.ok(
        typeof schema === "object" &&
            schema !== null &&
            "definitions" in schema,
    );
    const definitions = schema.definitions;
    assert.ok(
        typeof definitions === "object" &&
            definitions !== null &&
            "effectLanguageServicePluginDiagnosticSeverityDefinition" in
                definitions,
    );
    const definition =
        definitions.effectLanguageServicePluginDiagnosticSeverityDefinition;
    assert.ok(
        typeof definition === "object" &&
            definition !== null &&
            "properties" in definition &&
            typeof definition.properties === "object" &&
            definition.properties !== null,
    );
    const severities = await readDiagnosticSeverities();
    assert.deepEqual(
        Object.keys(severities).toSorted(),
        Object.keys(definition.properties).toSorted(),
    );
});
