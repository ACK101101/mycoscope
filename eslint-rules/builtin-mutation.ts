import ts from "typescript";

export interface BuiltinMutation {
    readonly target: ts.Expression;
    readonly stored: readonly ts.Expression[];
    readonly name: string;
    readonly binds: boolean;
}

const METHODS: Readonly<Record<string, readonly string[]>> = {
    Array: [
        "push",
        "pop",
        "shift",
        "unshift",
        "splice",
        "sort",
        "reverse",
        "fill",
        "copyWithin",
    ],
    Map: ["set", "delete", "clear"],
    Set: ["add", "delete", "clear"],
    WeakMap: ["set", "delete"],
    WeakSet: ["add", "delete"],
    URLSearchParams: ["append", "set", "delete", "sort"],
    Headers: ["append", "set", "delete"],
};

function ownerOf(declaration: ts.SignatureDeclaration): string | undefined {
    const parent = declaration.parent;
    if (ts.isInterfaceDeclaration(parent) || ts.isClassDeclaration(parent))
        return parent.name?.text;
    if (ts.isModuleBlock(parent) && ts.isModuleDeclaration(parent.parent))
        return parent.parent.name.getText();
    return undefined;
}

export function builtinMutation(
    call: ts.CallExpression,
    checker: ts.TypeChecker,
    program: ts.Program,
): BuiltinMutation | undefined {
    let declaration = checker.getResolvedSignature(call)?.declaration;
    const callee = call.expression;
    let args: readonly ts.Expression[] = call.arguments;
    let receiver: ts.Expression | undefined;
    let binds = false;
    if (
        ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)
    )
        receiver = callee.expression;
    if (
        declaration !== undefined &&
        "name" in declaration &&
        ["call", "apply", "bind"].includes(declaration.name.getText()) &&
        receiver !== undefined &&
        program.isSourceFileDefaultLibrary(declaration.getSourceFile())
    ) {
        const forwarding = declaration.name.getText();
        declaration = checker
            .getTypeAtLocation(receiver)
            .getCallSignatures()[0]?.declaration;
        receiver = args[0];
        const forwarded = args[1];
        args =
            forwarding === "apply" &&
            forwarded !== undefined &&
            ts.isArrayLiteralExpression(forwarded)
                ? forwarded.elements
                : args.slice(1);
        binds = forwarding === "bind";
    }
    if (declaration === undefined || !("name" in declaration)) return undefined;
    const owner = ownerOf(declaration);
    const name = declaration.name.getText();
    const file = declaration.getSourceFile();
    if (
        !program.isSourceFileDefaultLibrary(file) &&
        !(owner === "Buffer" && file.fileName.includes("/@types/node/"))
    )
        return undefined;
    if (
        (owner === "ObjectConstructor" &&
            [
                "assign",
                "defineProperty",
                "defineProperties",
                "setPrototypeOf",
            ].includes(name)) ||
        (owner === "Reflect" &&
            [
                "set",
                "defineProperty",
                "deleteProperty",
                "setPrototypeOf",
            ].includes(name))
    ) {
        const target = args[0];
        if (target === undefined) return undefined;
        return {
            target,
            stored: name === "assign" ? args.slice(1) : [],
            name,
            binds,
        };
    }
    const mutates =
        owner !== undefined &&
        (METHODS[owner]?.includes(name) === true ||
            (owner === "Date" && name.startsWith("set")) ||
            (owner === "Buffer" &&
                /^(write|fill|swap|reverse|sort|set)/u.test(name)) ||
            (/^(Uint|Int|Float|BigInt|BigUint).*Array$/u.test(owner) &&
                ["set", "fill", "copyWithin", "reverse", "sort"].includes(
                    name,
                )));
    if (!mutates || receiver === undefined) return undefined;
    let stored: readonly ts.Expression[] = [];
    if (["push", "unshift", "set", "add"].includes(name)) stored = args;
    else if (name === "splice") stored = args.slice(2);
    else if (name === "fill") stored = args.slice(0, 1);
    return { target: receiver, stored, name, binds };
}
