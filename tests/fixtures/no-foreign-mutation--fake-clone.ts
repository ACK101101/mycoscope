export function add(xs: readonly string[]): string[] {
    const structuredClone = (v: readonly string[]): string[] => [...v];
    const copy = structuredClone(xs);
    copy.push("x");
    return copy;
}
