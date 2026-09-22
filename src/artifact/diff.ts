import type { Graph } from '../graph/builder.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GraphDiff {}

export function diffArtifacts(a: Graph, b: Graph): GraphDiff {
  throw new Error('not implemented');
}
