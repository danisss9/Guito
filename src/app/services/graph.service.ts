import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import { filter, finalize, map, take } from 'rxjs/operators';
import { GraphWorkerResponse, LaneRow, assignLanes } from '../utils/graph';

/** Histories up to this size compute synchronously; the worker kicks in above. */
const SYNC_ROW_LIMIT = 2000;

/**
 * Computes commit graph lanes in a web worker so large histories (10k+ rows
 * after "Load all") never block the UI thread. Small inputs and environments
 * without worker support fall back to synchronous computation.
 */
@Injectable({ providedIn: 'root' })
export class GraphService implements OnDestroy {
  private worker: Worker | null = null;
  private workerBroken = false;
  private nextId = 0;
  private readonly activeIds = new Set<number>();
  private readonly replies = new Subject<GraphWorkerResponse>();

  compute(rows: readonly LaneRow[]): Observable<Int32Array> {
    if (rows.length <= SYNC_ROW_LIMIT) {
      return of(assignLanes(rows));
    }

    const worker = this.ensureWorker();
    if (!worker) {
      return of(assignLanes(rows));
    }

    const id = ++this.nextId;
    this.activeIds.add(id);
    worker.postMessage({
      id,
      hashes: rows.map((row) => row.hash),
      parents: rows.map((row) => [...row.parents]),
    });

    // Unsubscribing (e.g. a newer graph superseded this one) drops the reply.
    return this.replies.pipe(
      filter((reply) => reply.id === id),
      map((reply) => reply.lanes),
      take(1),
      finalize(() => this.activeIds.delete(id)),
    );
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.replies.complete();
  }

  private ensureWorker(): Worker | null {
    if (this.worker) {
      return this.worker;
    }
    if (this.workerBroken || typeof Worker === 'undefined') {
      this.workerBroken = true;
      return null;
    }

    try {
      this.worker = new Worker(new URL('../utils/graph.worker', import.meta.url), {
        type: 'module',
      });
    } catch {
      this.workerBroken = true;
      return null;
    }

    this.worker.onmessage = (event: MessageEvent<GraphWorkerResponse>) => {
      if (this.activeIds.has(event.data.id)) {
        this.replies.next(event.data);
      }
    };
    this.worker.onerror = () => {
      // The worker died (bad bundle, CSP, ...): fall back to the main thread.
      this.workerBroken = true;
      this.worker?.terminate();
      this.worker = null;
    };

    return this.worker;
  }
}
