import type { Config } from '../config/config.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WalkerOutput {}

export function walk(config: Config<string>): WalkerOutput {
  throw new Error('not implemented');
}
