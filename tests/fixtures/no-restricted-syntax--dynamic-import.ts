export async function f(s: string): Promise<unknown> {
    return import(s);
}
