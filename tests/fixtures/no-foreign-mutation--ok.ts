import type { Mut, MutDeep } from "../../src/mutation.js";
export function append(xs: readonly string[], x: string): string[] {
    const next: Mut<string[]> = [...xs];
    next.push(x);
    return next;
}

export function tally(words: readonly string[]): Map<string, number> {
    const counts: Mut<Map<string, number>> = new Map<string, number>();
    for (const word of words) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    return counts;
}

export function counter(): () => number {
    let total = 0;
    return () => {
        total += 1;
        return total;
    };
}

export function build(name: string): { name: string; tags: string[] } {
    const out: MutDeep<{ name: string; tags: string[] }> = { name, tags: [] };
    out.tags.push(name);
    return out;
}

export function sorted(xs: readonly number[]): number[] {
    const out: Mut<number[]> = [...xs];
    out.sort((a, b) => a - b);
    return out;
}

export function deepCopy(): { tags: string[] } {
    const copy: MutDeep<{ tags: string[] }> = structuredClone({ tags: ["a"] });
    copy.tags.push("x");
    return copy;
}

export function withRetries(options: { readonly retries: number }): { retries: number } {
    return Object.assign({}, options, { retries: 3 });
}

export class Counter {
    readonly count: number;

    constructor(count: number) {
        this.count = count;
    }

    bump(): Counter {
        return new Counter(this.count + 1);
    }
}
