/// <reference lib="webworker" />

import { GraphWorkerRequest, GraphWorkerResponse, assignLanes } from './graph';

/**
 * Computes commit graph lanes off the main thread. Receives hashes and parent
 * lists (the only inputs lane assignment needs), returns an index-aligned lane
 * array transferred back as a buffer.
 */
addEventListener('message', (event: MessageEvent<GraphWorkerRequest>) => {
  const { id, hashes, parents } = event.data;
  const lanes = assignLanes(
    hashes.map((hash, index) => ({ hash, parents: parents[index] ?? [] })),
  );
  const response: GraphWorkerResponse = { id, lanes };
  postMessage(response, [lanes.buffer]);
});
