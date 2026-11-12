import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { readEffectDiagnosticSeverities } from "../harness/effect-adapter.ts";

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
    const severities = await readEffectDiagnosticSeverities();
    assert.deepEqual(
        Object.keys(severities).toSorted(),
        Object.keys(definition.properties).toSorted(),
    );
});
