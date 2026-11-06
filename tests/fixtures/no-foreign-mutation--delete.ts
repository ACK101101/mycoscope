export function drop(options: { retries?: number }): void {
    delete options.retries;
}
