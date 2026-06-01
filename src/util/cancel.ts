// Cooperative cancellation. A daemon signals cancel() at a phase boundary; the
// cycle checks isCancelled.
export class CancellationToken {
  private cancelled = false;
  private waiters: (() => void)[] = [];

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const w of this.waiters) w();
    this.waiters = [];
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  /** Resolves when cancelled, or after `ms`, whichever comes first. */
  sleep(ms: number): Promise<void> {
    if (this.cancelled) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== onCancel);
        resolve();
      }, ms);
      const onCancel = () => {
        clearTimeout(timer);
        resolve();
      };
      this.waiters.push(onCancel);
    });
  }
}
