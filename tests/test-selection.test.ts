import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { selectTests } from "../scripts/testing/selection.ts";

void test("static suite entries import every discovered test exactly once", () => {
    const files = readdirSync("tests", {
        recursive: true,
        encoding: "utf8",
    }).map((file) => "tests/" + file.split(sep).join("/"));
    for (const selection of ["unit", "integration"] as const) {
        const entry = `tests/suites/${selection}.ts`;
        const source = ts.createSourceFile(
            entry,
            readFileSync(entry, "utf8"),
            ts.ScriptTarget.Latest,
            true,
        );
        const imported = source.statements.map((statement) => {
            assert.ok(
                ts.isImportDeclaration(statement) &&
                    statement.importClause === undefined &&
                    ts.isStringLiteral(statement.moduleSpecifier),
                "Suite entries must contain only explicit side-effect imports.",
            );
            return relative(
                process.cwd(),
                resolve(dirname(entry), statement.moduleSpecifier.text),
            )
                .split(sep)
                .join("/");
        });
        assert.deepEqual(imported.toSorted(), selectTests(files, selection));
        const unique = new Set(imported);
        assert.equal(unique.size, imported.length);
    }
});
