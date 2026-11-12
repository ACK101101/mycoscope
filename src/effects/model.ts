export interface SymbolRef {
    readonly module: string;
    readonly export: string;
}
export interface Executable {
    readonly command: string;
    readonly root: SymbolRef;
}
export interface Policy {
    readonly executables?: readonly Executable[];
    readonly rootDirectory: string;
    readonly wiringRoots: readonly SymbolRef[];
    readonly adapters: readonly SymbolRef[];
}
export type Rule =
    | "effect-contract"
    | "wiring-boundary"
    | "unresolved-wiring"
    | "implicit-capability"
    | "invalid-policy"
    | "exception-reason";
export interface Site {
    readonly file: string;
    readonly line: number;
}
export interface Issue extends Site {
    readonly rule: Rule;
    readonly message: string;
}
export interface Exception extends Issue {
    readonly reason: string;
}
export interface GraphNode extends Site {
    readonly id: string;
    readonly label: string;
    // Local means inspectable source, never a proof of purity or successful execution.
    readonly verification: "local" | "unverified";
}
export interface Edge {
    readonly from: string;
    readonly to: string;
    readonly kind:
        "references" | "contains" | "requires" | "capability" | "launches";
}
export interface Contract extends Site {
    readonly node: string;
    readonly kind: "Effect" | "Layer";
    readonly success: string;
    readonly error: string;
    readonly requirements: string;
}
export interface Report {
    readonly wiringRoots: readonly string[];
    readonly adapters: readonly string[];
    readonly nodes: readonly GraphNode[];
    readonly edges: readonly Edge[];
    readonly contracts: readonly Contract[];
    readonly issues: readonly Issue[];
    readonly exceptions: readonly Exception[];
}
