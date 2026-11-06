function cache(): { n: number } {
    return { n: 1 };
}

export function reset(): void {
    cache().n = 0;
}
