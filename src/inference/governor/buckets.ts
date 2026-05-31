// Port of src-tauri/src/inference/governor/buckets.rs — token buckets for
// Anthropic rate-limits: RPM, ITPM, OTPM.
//
// The Rust uses the `governor` crate's leaky/token-bucket limiter. Here we
// implement a simple continuous-refill token bucket per dimension: capacity =
// the per-minute rate, refill rate = rate/60 tokens per second. `acquire`
// awaits until enough capacity is available across all three dimensions, then
// debits them. Non-busy: it polls with a small setTimeout when it has to wait.

export interface BucketSettings {
  rpm: number;
  itpm: number;
  otpm: number;
}

const POLL_INTERVAL_MS = 75;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A single continuous-refill token bucket. */
class TokenBucket {
  private capacity: number;
  private refillPerMs: number;
  private tokens: number;
  private lastRefill: number;

  constructor(ratePerMinute: number) {
    const rate = Math.max(1, ratePerMinute);
    this.capacity = rate;
    // Per-minute rate spread continuously: rate/60 per second = rate/60000 per ms.
    this.refillPerMs = rate / 60_000;
    this.tokens = rate; // start full
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
      this.lastRefill = now;
    }
  }

  /** Try to debit `n` tokens. Returns true if it succeeded. */
  tryAcquire(n: number): boolean {
    this.refill();
    // A request can never need more than the bucket's whole capacity; clamp the
    // demand so an over-large reservation cannot deadlock forever (mirrors the
    // `governor` crate, which caps n at the burst capacity).
    const need = Math.min(n, this.capacity);
    if (this.tokens >= need) {
      this.tokens -= need;
      return true;
    }
    return false;
  }
}

export class Buckets {
  private requests: TokenBucket;
  private inputTokens: TokenBucket;
  private outputTokens: TokenBucket;

  constructor(settings: BucketSettings) {
    this.requests = new TokenBucket(settings.rpm);
    this.inputTokens = new TokenBucket(settings.itpm);
    this.outputTokens = new TokenBucket(settings.otpm);
  }

  /**
   * Rebuild buckets with new limits. Existing reservations are discarded — the
   * new limit takes effect immediately for subsequent calls.
   */
  rebuild(settings: BucketSettings): void {
    this.requests = new TokenBucket(settings.rpm);
    this.inputTokens = new TokenBucket(settings.itpm);
    this.outputTokens = new TokenBucket(settings.otpm);
  }

  /**
   * Wait until one request slot, `estIn` input tokens, and `estOut` output
   * tokens are all available, then debit them. Mirrors the Rust ordering:
   * request slot first, then input tokens, then output tokens.
   */
  async acquire(estIn: number, estOut: number): Promise<void> {
    while (!this.requests.tryAcquire(1)) {
      await sleep(POLL_INTERVAL_MS);
    }
    const needIn = Math.max(1, estIn);
    while (!this.inputTokens.tryAcquire(needIn)) {
      await sleep(POLL_INTERVAL_MS);
    }
    const needOut = Math.max(1, estOut);
    while (!this.outputTokens.tryAcquire(needOut)) {
      await sleep(POLL_INTERVAL_MS);
    }
  }
}
