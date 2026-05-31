// Port of src-tauri/src/inference/governor/breaker.rs — circuit breaker for 429s.
//
// - Closed: normal operation, every 429 timestamp is appended to a sliding window.
// - Open: when >= THRESHOLD timestamps land within WINDOW, we open for COOL_DOWN.
//   While open, every governed call returns BreakerOpen immediately.
// - Half-open: after COOL_DOWN, the first call is allowed through; if it succeeds
//   we close; if it 429s we re-open.

const WINDOW_MS = 60_000; // 60s sliding window
const COOL_DOWN_MS = 300_000; // 5 min
const THRESHOLD = 3;

export class Breaker {
  private recent429s: number[] = [];
  private openUntil: number | null = null;

  /**
   * Milliseconds remaining if the breaker is open, else `null` (closed, or
   * half-open: we let the first call through).
   */
  openFor(): number | null {
    if (this.openUntil === null) return null;
    const now = Date.now();
    if (now >= this.openUntil) return null;
    return this.openUntil - now;
  }

  on429(retryAfterSecs?: number | null): void {
    const now = Date.now();
    this.recent429s.push(now);
    this.prune(now);

    if (this.recent429s.length >= THRESHOLD) {
      // Use retry-after only if it exceeds the standard cool-down.
      const retryMs = retryAfterSecs != null ? retryAfterSecs * 1000 : null;
      const coolDown = retryMs != null && retryMs > COOL_DOWN_MS ? retryMs : COOL_DOWN_MS;
      this.openUntil = now + coolDown;
    } else if (retryAfterSecs != null) {
      // Even one 429 with a Retry-After header → respect it locally.
      this.openUntil = now + retryAfterSecs * 1000;
    }
  }

  onSuccess(): void {
    // A successful call after the cool-down implicitly closes the breaker.
    // Clear the window so a transient burst doesn't count against us forever.
    const now = Date.now();
    this.prune(now);
    if (this.openUntil === null || now >= this.openUntil) {
      this.openUntil = null;
    }
  }

  private prune(now: number): void {
    while (this.recent429s.length > 0 && now - this.recent429s[0] > WINDOW_MS) {
      this.recent429s.shift();
    }
  }
}
