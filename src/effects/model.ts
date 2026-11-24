export interface SymbolRef {
    readonly module: string;
    readonly export: string;
}
export interface Policy {
    readonly rootDirectory: string;
    readonly wiringRoots: readonly SymbolRef[];
    readonly adapters: readonly SymbolRef[];
}
export type Rule =
    | "effect-contract"
    | "wiring-boundary"
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
export interface Findings {
    readonly issues: readonly Issue[];
    readonly exceptions: readonly Exception[];
}
