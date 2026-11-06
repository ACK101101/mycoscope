type U = "a" | "b";
export function f(u: U): number {
    switch (u) {
        case "a":
            return 1;
    }
    return 0;
}
