import ts from "typescript";
import { apiSymbol, effectModule, parentOf, symbolAt } from "./symbols.js";

export interface Operation {
    readonly target: ts.Symbol | undefined;
    readonly inputs: readonly ts.Expression[];
}
const CONSTRUCTION_PARAMETERS = new Set([
    "self",
    "layer",
    "layers",
    "context",
    "service",
    "implementation",
    "acquire",
    "that",
]);
// Resolve the actual overload, including returned callable signatures. Looking only at the
// surface callee or the last argument loses curry stages and mistakes options for providers.
export function operation(
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    call: ts.CallExpression,
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    checker: ts.TypeChecker,
): Operation {
    const signature = checker.getResolvedSignature(call);
    let target = apiSymbol(call.expression, checker);
    let declaration: ts.Node | undefined = signature?.declaration;
    while (declaration !== undefined) {
        if (ts.isVariableDeclaration(declaration)) {
            const symbol = symbolAt(declaration.name, checker);
            if (effectModule(symbol) !== undefined) {
                target = symbol;
                break;
            }
        }
        declaration = parentOf(declaration);
    }
    const inputs: ts.Expression[] = [];
    const parameters = signature?.parameters ?? [];
    for (const [index, parameter] of parameters.entries()) {
        const argument = call.arguments[index];
        if (
            argument !== undefined &&
            CONSTRUCTION_PARAMETERS.has(parameter.getName())
        )
            inputs.push(argument);
    }
    return { target, inputs };
}
