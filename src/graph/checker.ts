import type { Config } from '../config/config.js';
import type { Graph } from './builder.js';

export function checkGraph(_graph: Graph, _config: Config<string>): void {
  throw new Error('not implemented');
}
