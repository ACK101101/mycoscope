import type { Config } from '../config/config.js';
import type { WalkerOutput } from './walker.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Graph {}

export function buildGraph(output: WalkerOutput, config: Config<string>): Graph {
  throw new Error('not implemented');
}
