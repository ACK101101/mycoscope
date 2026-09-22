import type { Config } from '../config/config.js';
import type { Graph } from './builder.js';

export function checkGraph(graph: Graph, config: Config<string>): void {
  throw new Error('not implemented');
}
