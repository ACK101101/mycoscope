const cache = new Map<string, number>();

export function put(key: string, value: number): void {
    cache.set(key, value);
}
