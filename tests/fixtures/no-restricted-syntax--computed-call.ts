export function f(o: Record<string, () => void>, k: string): void {
    o[k]?.();
}
