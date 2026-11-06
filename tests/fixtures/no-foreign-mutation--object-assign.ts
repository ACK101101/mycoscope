export function configure(options: { retries: number }): void {
    Object.assign(options, { retries: 3 });
}
