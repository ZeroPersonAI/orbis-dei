// Port of src-tauri/src/inference/mod.rs — shared inference types.

/** The six loop phases, in execution order. */
export type Phase = "observe" | "diverge" | "elect" | "expand" | "review" | "integrate";

/** All phases in order — mirrors `Phase::ALL` in the Rust. */
export const PHASES: Phase[] = [
  "observe",
  "diverge",
  "elect",
  "expand",
  "review",
  "integrate",
];

/**
 * Generous cap: reasoning-capable models can spend several thousand tokens
 * thinking before emitting the answer. 4096 was too tight — the model would
 * exhaust the budget mid-reasoning and return no text block.
 */
export const DEFAULT_MAX_TOKENS = 16384;

/**
 * Provider-agnostic chat result. Token fields are `null` when the provider
 * does not report them (e.g. OpenAI without a usage block).
 */
export interface ChatResponse {
  content: string;
  /** Non-cached input tokens (i.e. the "dynamic" tail of the request). */
  inputTokens: number | null;
  outputTokens: number | null;
  /** Tokens written to the Anthropic prompt cache this call (~1.25x input). */
  cacheCreateTokens: number | null;
  /** Tokens read back from the prompt cache (~0.1x input). */
  cacheReadTokens: number | null;
  model: string;
  latencyMs: number;
}
