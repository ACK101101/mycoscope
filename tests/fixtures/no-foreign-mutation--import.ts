import { env } from "node:process";

export function setMode(): void {
    env["MODE"] = "x";
}
