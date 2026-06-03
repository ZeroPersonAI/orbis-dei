// The inference governor: rate-limits + circuit breaker + fair queueing.
//
// Every provider call (Anthropic / OpenAI / Gemini) goes through
// `Governor.governedChat`, which records it in `inference_calls` under its
// provider name so the per-instance activity view stays unified.

import { AppError, internal } from "../../error.ts";
import type { DB } from "../../persistence/db.ts";
import { type ChatResponse, DEFAULT_MAX_TOKENS } from "../index.ts";
import { chatVia, type ProviderClient } from "../provider.ts";
import { Breaker } from "./breaker.ts";
import { Buckets } from "./buckets.ts";
import { Queue } from "./queue.ts";

/** Tunable knobs the governor reads from Settings. */
export interface GovernorSettings {
  rpm: number;
  itpm: number;
  otpm: number;
}

/**
 * Rough token estimate. A real tokenizer would be tiktoken / Anthropic's
 * counter; chars/4 is plenty for pre-flight rate-bucket reservation — the
 * actual usage from the response is what hits the DB.
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.floor(text.length / 4));
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "…";
}

interface RecordCallArgs {
  instanceId: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreateTokens: number | null;
  cacheReadTokens: number | null;
  latencyMs: number | null;
  rateLimited: boolean;
  queueWaitMs: number | null;
  error: string | null;
  createdAt: string;
}

export class Governor {
  private buckets: Buckets;
  private breaker = new Breaker();
  private queue = new Queue();

  constructor(settings: GovernorSettings) {
    this.buckets = new Buckets({ rpm: settings.rpm, itpm: settings.itpm, otpm: settings.otpm });
  }

  async reconfigure(newSettings: GovernorSettings): Promise<void> {
    this.buckets.rebuild({
      rpm: newSettings.rpm,
      itpm: newSettings.itpm,
      otpm: newSettings.otpm,
    });
  }

  /**
   * All-in-one wrapper around any provider's chat. Enforces rate-bucket /
   * breaker / queue, records the call in `inference_calls` under `provider`,
   * and surfaces structured errors.
   */
  async governedChat(
    db: DB,
    client: ProviderClient,
    provider: string,
    instanceId: string,
    model: string,
    system: string,
    stableUser: string,
    dynamicUser: string,
  ): Promise<ChatResponse> {
    const queueStarted = Date.now();

    // 1. Estimate input/output tokens for rate-bucket reservation.
    //    Pessimistic upper bound — caching is not factored in.
    const estIn =
      estimateTokens(system) + estimateTokens(stableUser) + estimateTokens(dynamicUser) + 32;
    const estOut = DEFAULT_MAX_TOKENS;

    // 2. Circuit breaker check.
    {
      const reopensInMs = this.breaker.openFor();
      if (reopensInMs !== null) {
        const secs = Math.floor(reopensInMs / 1000);
        throw internal(`BreakerOpen: ${provider} rate-limited, cool-down in ${secs}s`);
      }
    }

    // 3. Weighted-fair-queue gate — waits for this instance's turn.
    const ticket = await this.queue.acquire(instanceId);
    const queueWaitMs = Date.now() - queueStarted;

    // 4. Token-bucket waits (RPM, ITPM, OTPM) — secondary hard rate guard.
    await this.buckets.acquire(estIn, estOut);

    // 5. Actual HTTP call.
    let result: ChatResponse | null = null;
    let callError: unknown = null;
    try {
      result = await chatVia(client, model, system, stableUser, dynamicUser);
    } catch (e) {
      callError = e;
    }
    const totalWaitMs = Date.now() - queueStarted;

    // 5b. Release the WFQ gate so the next instance can proceed.
    await this.queue.release(ticket);

    // 6. Record + breaker update.
    const now = new Date().toISOString();
    if (result !== null) {
      const inT = result.inputTokens ?? 0;
      const outT = result.outputTokens ?? 0;
      this.recordCall(db, {
        instanceId,
        provider,
        model,
        inputTokens: inT,
        outputTokens: outT,
        cacheCreateTokens: result.cacheCreateTokens,
        cacheReadTokens: result.cacheReadTokens,
        latencyMs: result.latencyMs,
        rateLimited: queueWaitMs > 50,
        queueWaitMs,
        error: null,
        createdAt: now,
      });
      this.breaker.onSuccess();
      return result;
    }

    // Error path: distinguish 429 (rate-limited) from other failures.
    if (callError instanceof AppError && callError.kind === "rate_limited") {
      this.breaker.on429(callError.retryAfterSecs ?? null);
      this.recordCall(db, {
        instanceId,
        provider,
        model,
        inputTokens: null,
        outputTokens: null,
        cacheCreateTokens: null,
        cacheReadTokens: null,
        latencyMs: totalWaitMs,
        rateLimited: true,
        queueWaitMs,
        error: `429: ${truncate(callError.message, 200)}`,
        createdAt: now,
      });
    } else {
      const msg =
        callError instanceof Error ? callError.message : String(callError);
      this.recordCall(db, {
        instanceId,
        provider,
        model,
        inputTokens: null,
        outputTokens: null,
        cacheCreateTokens: null,
        cacheReadTokens: null,
        latencyMs: totalWaitMs,
        rateLimited: false,
        queueWaitMs,
        error: `error: ${truncate(msg, 200)}`,
        createdAt: now,
      });
    }
    throw callError;
  }

  private recordCall(db: DB, a: RecordCallArgs): void {
    db.prepare(
      `INSERT INTO inference_calls
          (loop_event_id, instance_id, provider, model,
           input_tokens, output_tokens, cache_create_tokens, cache_read_tokens,
           latency_ms,
           rate_limited, queue_wait_ms, error, created_at)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      a.instanceId,
      a.provider,
      a.model,
      a.inputTokens,
      a.outputTokens,
      a.cacheCreateTokens,
      a.cacheReadTokens,
      a.latencyMs,
      a.rateLimited ? 1 : 0,
      a.queueWaitMs,
      a.error,
      a.createdAt,
    );
  }

  /** Current queue depth (waiting + in-flight calls). */
  async queueDepth(): Promise<number> {
    return this.queue.depth();
  }

  /** `[open, secondsUntilReopen]`. `[false, null]` means closed. */
  async breakerStatus(): Promise<[boolean, number | null]> {
    const ms = this.breaker.openFor();
    if (ms === null) return [false, null];
    return [true, Math.floor(ms / 1000)];
  }
}
