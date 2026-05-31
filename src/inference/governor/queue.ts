// Port of src-tauri/src/inference/governor/queue.rs — weighted fair queue across
// instances.
//
// Classic virtual-time WFQ. Each call is assigned a virtual finish time
// `start + 1/weight`, where `start` is the later of the global virtual clock and
// the instance's own last finish time. Calls proceed in ascending
// virtual-finish order, one at a time. An idle instance can't bank credit — its
// `start` jumps forward to the current virtual clock.
//
// The Rust uses tokio Mutex + Notify. JS is single-threaded and cooperative, so
// the "lock" is implicit between awaits; we replace `Notify` with a set of
// pending waker callbacks that we resolve on `release`.

interface Waiter {
  seq: number;
  virtualFinish: number;
}

/** Returned by `acquire`, consumed by `release`. */
export interface Ticket {
  virtualFinish: number;
}

export class Queue {
  private virtualClock = 0;
  private lastFinish = new Map<string, number>();
  private weights = new Map<string, number>();
  private waiting: Waiter[] = [];
  private running = 0;
  private seq = 0;

  // Wakers for tasks parked in `acquire`. Resolving one lets that loop re-check
  // the head condition — the JS equivalent of tokio's `notify_waiters()`.
  private wakers: Array<() => void> = [];

  /** Set an instance's weight. Default (unset) is 1.0. Higher = more throughput. */
  setWeight(instanceId: string, weight: number): void {
    this.weights.set(instanceId, Math.max(0.01, weight));
  }

  private notifyAll(): void {
    const wakers = this.wakers;
    this.wakers = [];
    for (const w of wakers) w();
  }

  private nextWake(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.wakers.push(resolve);
    });
  }

  /**
   * Acquire the gate in weighted-fair order. Awaits until it is this instance's
   * turn AND nothing else is running.
   */
  async acquire(instanceId: string): Promise<Ticket> {
    const weight = this.weights.get(instanceId) ?? 1.0;
    const start = Math.max(
      this.lastFinish.get(instanceId) ?? this.virtualClock,
      this.virtualClock,
    );
    const virtualFinish = start + 1.0 / weight;
    this.lastFinish.set(instanceId, virtualFinish);
    this.seq += 1;
    const mySeq = this.seq;
    this.waiting.push({ seq: mySeq, virtualFinish });

    for (;;) {
      // Register the waker BEFORE checking the condition, so a notify between the
      // check and the await is not missed (mirrors the Rust ordering).
      const notified = this.nextWake();
      const head = this.headWaiter();
      const isHead = head !== null && head.seq === mySeq;
      if (isHead && this.running === 0) {
        this.waiting = this.waiting.filter((w) => w.seq !== mySeq);
        this.running += 1;
        return { virtualFinish };
      }
      await notified;
    }
  }

  // Kept `async` for call-site symmetry with the Rust `release`; the body is
  // synchronous because JS is single-threaded between awaits.
  async release(ticket: Ticket): Promise<void> {
    this.running = Math.max(0, this.running - 1);
    this.virtualClock = Math.max(this.virtualClock, ticket.virtualFinish);
    this.notifyAll();
  }

  /** Calls currently waiting + the one running. Drives the UI queue badge. */
  depth(): number {
    return this.waiting.length + this.running;
  }

  private headWaiter(): Waiter | null {
    let best: Waiter | null = null;
    for (const w of this.waiting) {
      if (
        best === null ||
        w.virtualFinish < best.virtualFinish ||
        (w.virtualFinish === best.virtualFinish && w.seq < best.seq)
      ) {
        best = w;
      }
    }
    return best;
  }
}
