export function f(x: unknown): string {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixture: reasoned disable is allowed
    return x as string;
}
