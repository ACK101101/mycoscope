import ts from "typescript";
import { apiSymbol, effectModule, parentOf, symbolAt } from "./symbols.js";

// Resolve the actual overload, including returned callable signatures. Looking only at the
// surface callee loses curry stages, such as `Effect.provideService(Tag)(implementation)`.
export function calledApi(
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    call: ts.CallExpression,
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- This traversal consumes TypeScript compiler objects with mutable fields.
    checker: ts.TypeChecker,
): ts.Symbol | undefined {
    let target = apiSymbol(call.expression, checker);
    let declaration: ts.Node | undefined =
        checker.getResolvedSignature(call)?.declaration;
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
    return target;
}
