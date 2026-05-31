// Port of src-tauri/src/inference/governor/pricing.rs — static per-model pricing
// (USD per 1M tokens). Unknown models default to Opus-4 pricing as a
// conservative cap.

export interface ModelPricing {
  /** USD per 1,000,000 input tokens (no cache). */
  inputPerMtok: number;
  /** USD per 1,000,000 output tokens. */
  outputPerMtok: number;
  /** USD per 1,000,000 tokens written to the prompt cache (~1.25x input). */
  cacheWritePerMtok: number;
  /** USD per 1,000,000 tokens read from the prompt cache (~0.1x input). */
  cacheReadPerMtok: number;
}

// OpenAI/Gemini have no prompt cache via the OpenAI-compatible path, so cache_*
// are set to input pricing as a harmless cap (they should never be billed).
function oa(inp: number, out: number): ModelPricing {
  return {
    inputPerMtok: inp,
    outputPerMtok: out,
    cacheWritePerMtok: inp,
    cacheReadPerMtok: inp,
  };
}

export class PricingTable {
  private entries: Map<string, ModelPricing>;
  private fallback: ModelPricing;

  constructor() {
    this.entries = new Map<string, ModelPricing>();

    // Claude 4.x family — Anthropic's published list prices, with cache_write
    // at 1.25x normal input and cache_read at 0.1x.
    const opus: ModelPricing = {
      inputPerMtok: 15.0,
      outputPerMtok: 75.0,
      cacheWritePerMtok: 18.75,
      cacheReadPerMtok: 1.5,
    };
    const sonnet: ModelPricing = {
      inputPerMtok: 3.0,
      outputPerMtok: 15.0,
      cacheWritePerMtok: 3.75,
      cacheReadPerMtok: 0.3,
    };
    this.entries.set("claude-opus-4-7", opus);
    this.entries.set("claude-opus-4-6", opus);
    this.entries.set("claude-sonnet-4-6", sonnet);
    this.entries.set("claude-sonnet-4-5", sonnet);
    this.entries.set("claude-haiku-4-5", {
      inputPerMtok: 0.8,
      outputPerMtok: 4.0,
      cacheWritePerMtok: 1.0,
      cacheReadPerMtok: 0.08,
    });

    // OpenAI (list pricing, USD/Mtok).
    this.entries.set("gpt-4o", oa(2.5, 10.0));
    this.entries.set("gpt-4o-mini", oa(0.15, 0.6));
    this.entries.set("gpt-4.1", oa(2.0, 8.0));
    this.entries.set("gpt-4.1-mini", oa(0.4, 1.6));
    this.entries.set("gpt-4.1-nano", oa(0.1, 0.4));
    this.entries.set("o3", oa(2.0, 8.0));
    this.entries.set("o4-mini", oa(1.1, 4.4));

    // Google Gemini (list pricing, USD/Mtok).
    this.entries.set("gemini-2.0-flash", oa(0.1, 0.4));
    this.entries.set("gemini-2.5-flash", oa(0.3, 2.5));
    this.entries.set("gemini-2.5-pro", oa(1.25, 10.0));
    this.entries.set("gemini-1.5-pro", oa(1.25, 5.0));
    this.entries.set("gemini-1.5-flash", oa(0.075, 0.3));

    // Fallback = Opus pricing (conservative cap).
    this.fallback = opus;
  }

  get(model: string): ModelPricing {
    return this.entries.get(model) ?? this.fallback;
  }

  /**
   * Pre-flight cost estimate (over-counts because we treat max_tokens as the
   * actual output, and we don't yet know how much will be cached). Used to
   * refuse calls that would obviously exceed the budget.
   */
  estimateCost(model: string, estIn: number, estOut: number): number {
    const p = this.get(model);
    return (estIn / 1_000_000) * p.inputPerMtok + (estOut / 1_000_000) * p.outputPerMtok;
  }

  /** Actual cost from real usage numbers, including prompt-cache breakdowns. */
  actualCost(
    model: string,
    inTokens: number,
    outTokens: number,
    cacheCreate: number,
    cacheRead: number,
  ): number {
    const p = this.get(model);
    const f = (t: number, perMtok: number) => (t / 1_000_000) * perMtok;
    return (
      f(inTokens, p.inputPerMtok) +
      f(outTokens, p.outputPerMtok) +
      f(cacheCreate, p.cacheWritePerMtok) +
      f(cacheRead, p.cacheReadPerMtok)
    );
  }
}
