import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subscriber, of } from 'rxjs';
import { GraphWorkerResponse, LaneRow, assignLanes } from '../utils/graph';

const SYNC_ROW_LIMIT = 2000;

@Injectable({ providedIn: 'root' })
export class GraphService implements OnDestroy {
  private worker: Worker | null = null;
  private workerBroken = false;
  private nextId = 0;
  private readonly pending = new Map<number, { rows: readonly LaneRow[]; subscriber: Subscriber<Int32Array> }>();

  compute(rows: readonly LaneRow[]): Observable<Int32Array> {
    if (rows.length <= SYNC_ROW_LIMIT) return of(assignLanes(rows));
    return new Observable(subscriber => {
      const worker = this.ensureWorker();
      if (!worker) { subscriber.next(assignLanes(rows)); subscriber.complete(); return; }
      const id = ++this.nextId;
      this.pending.set(id, { rows, subscriber });
      const timeout = setTimeout(() => this.fallback(), 15000);
      try {
        worker.postMessage({ id, hashes: rows.map(row => row.hash), parents: rows.map(row => [...row.parents]) });
      } catch { this.fallback(); }
      return () => { clearTimeout(timeout); this.pending.delete(id); };
    });
  }

  private fallback(): void {
    this.workerBroken = true;
    this.worker?.terminate(); this.worker = null;
    for (const [id, request] of this.pending) {
      this.pending.delete(id);
      request.subscriber.next(assignLanes(request.rows));
      request.subscriber.complete();
    }
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.workerBroken || typeof Worker === 'undefined') return null;
    try {
      this.worker = new Worker(new URL('../utils/graph.worker', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<GraphWorkerResponse>) => {
        const request = this.pending.get(event.data.id);
        if (!request) return;
        if (!(event.data.lanes instanceof Int32Array) || event.data.lanes.length !== request.rows.length) {
          this.fallback(); return;
        }
        request.subscriber.next(event.data.lanes);
        request.subscriber.complete();
      };
      this.worker.onerror = () => this.fallback();
      this.worker.onmessageerror = () => this.fallback();
      return this.worker;
    } catch { this.fallback(); return null; }
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
    for (const request of this.pending.values()) request.subscriber.complete();
    this.pending.clear();
  }
}
