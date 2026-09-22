import type { Graph } from '../graph/builder.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GraphDiff {}

export function diffArtifacts(_a: Graph, _b: Graph): GraphDiff {
  throw new Error('not implemented');
}
