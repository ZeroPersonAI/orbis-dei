// Anthropic Messages API client with prompt-caching breakpoints, a retry policy
// for transient failures, and a tool-use chat mode.

import { AppError, internal, rateLimited } from "../error.ts";
import { type ChatResponse, DEFAULT_MAX_TOKENS } from "./index.ts";

export const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Phase 20 — retry policy for transient upstream failures.
 *
 * HTTP 5xx and network/fetch errors get retried with exponential backoff
 * (1s, 3s, 9s). 4xx, 429 (handled by the breaker via RateLimited), parse
 * errors and empty-response errors are NOT retried — they're either permanent
 * (auth, bad payload) or already routed through their own path.
 */
const MAX_RETRIES = 3;

/** Request timeout in milliseconds (600s). */
const REQUEST_TIMEOUT_MS = 600_000;

/** attempt=1 → 1s, attempt=2 → 3s, attempt=3 → 9s, capped at 30s. */
function backoffMs(attempt: number): number {
  const secs = Math.min(Math.pow(3, Math.max(0, attempt - 1)), 30);
  return secs * 1000;
}

function isTransientAnthropicError(e: unknown): boolean {
  // The HTTP-non-success branch formats as "anthropic HTTP {status}: ...".
  // The send-error branch formats as "anthropic request: ...".
  // 429 is its own rate_limited AppError and never reaches internal.
  // Parse errors and the empty-response error are deliberately NOT retried.
  if (e instanceof AppError && e.kind === "internal") {
    return e.message.includes("anthropic HTTP 5") || e.message.includes("anthropic request:");
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Response shape -------------------------------------------------------

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

interface MessagesResponse {
  model: string;
  content: ContentBlock[];
  usage: Usage;
  stop_reason?: string | null;
}

// --- Tool-use types (Phase 11) --------------------------------------------

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: unknown;
}

export type AssistantBlock =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; id: string; name: string; input: unknown };

export interface ToolUse {
  id: string;
  name: string;
  input: unknown;
}

/** One assistant turn from a tool-use conversation. */
export class AssistantTurn {
  constructor(
    public blocks: AssistantBlock[],
    public stopReason: string | null,
    public inputTokens: number,
    public outputTokens: number,
  ) {}

  /** Concatenated text from all text blocks. */
  text(): string {
    let s = "";
    for (const b of this.blocks) {
      if (b.kind === "text") s += b.text;
    }
    return s;
  }

  /** All tool_use blocks the model emitted. */
  toolUses(): ToolUse[] {
    const out: ToolUse[] = [];
    for (const b of this.blocks) {
      if (b.kind === "tool_use") out.push({ id: b.id, name: b.name, input: b.input });
    }
    return out;
  }

  /**
   * Reconstruct the JSON `content` array for sending this turn back as an
   * `assistant` message — preserves tool_use blocks the model emitted.
   */
  toMessageContent(): unknown[] {
    return this.blocks.map((b) => {
      if (b.kind === "text") return { type: "text", text: b.text };
      return { type: "tool_use", id: b.id, name: b.name, input: b.input };
    });
  }
}

export class AnthropicClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  /**
   * POST /v1/messages with prompt-caching breakpoints.
   *
   * - `system` is the phase template — cacheable.
   * - `stableUser` is identity + standing concerns — cacheable.
   * - `dynamicUser` is state.md + recent episodic + stimuli — NOT cached.
   *
   * Anthropic returns `usage.cache_creation_input_tokens` /
   * `usage.cache_read_input_tokens` alongside the normal `input_tokens`.
   */
  async chat(
    model: string,
    system: string,
    stableUser: string,
    dynamicUser: string,
  ): Promise<ChatResponse> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(backoffMs(attempt));
      }
      try {
        return await this.chatOnce(model, system, stableUser, dynamicUser);
      } catch (e) {
        if (!isTransientAnthropicError(e)) throw e;
        lastErr = e;
      }
    }
    throw lastErr ?? internal("anthropic chat: retries exhausted (no error captured)");
  }

  private async post(payload: unknown): Promise<Response> {
    const url = `${this.baseUrl}/v1/messages`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (e) {
      // Network / fetch / abort failure — transient, formatted with the
      // "anthropic request:" prefix so the retry classifier picks it up.
      throw internal(`anthropic request: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleErrorStatus(resp: Response): Promise<never> {
    const status = resp.status;
    if (status === 429) {
      const ra = resp.headers.get("retry-after");
      const retryAfterSecs = ra !== null && /^\d+$/.test(ra.trim()) ? Number(ra.trim()) : null;
      const body = await resp.text().catch(() => "");
      throw rateLimited(body, retryAfterSecs);
    }
    const body = await resp.text().catch(() => "");
    throw internal(`anthropic HTTP ${status}: ${body}`);
  }

  private async chatOnce(
    model: string,
    system: string,
    stableUser: string,
    dynamicUser: string,
  ): Promise<ChatResponse> {
    const payload = {
      model,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: stableUser, cache_control: { type: "ephemeral" } },
            { type: "text", text: dynamicUser },
          ],
        },
      ],
    };

    const started = Date.now();
    const resp = await this.post(payload);

    if (!resp.ok) await this.handleErrorStatus(resp);

    let parsed: MessagesResponse;
    try {
      parsed = (await resp.json()) as MessagesResponse;
    } catch (e) {
      throw internal(`anthropic parse: ${e instanceof Error ? e.message : String(e)}`);
    }

    const blockTypes = parsed.content.map((b) => b.type);
    const content = parsed.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    // A successful HTTP 200 with no text block is almost always a reasoning
    // model that ran out of max_tokens while still thinking. Surface that as an
    // actionable error rather than letting it slip through as empty output.
    if (content.trim().length === 0) {
      throw internal(
        `model returned an empty text response (stop_reason=${JSON.stringify(parsed.stop_reason)}, ` +
          `blocks=${JSON.stringify(blockTypes)}, output_tokens=${parsed.usage?.output_tokens ?? "?"}). ` +
          `The model likely exhausted max_tokens before emitting an answer — raise ` +
          `DEFAULT_MAX_TOKENS or use a less verbose model.`,
      );
    }

    return {
      content,
      inputTokens: parsed.usage.input_tokens,
      outputTokens: parsed.usage.output_tokens,
      cacheCreateTokens: parsed.usage.cache_creation_input_tokens ?? null,
      cacheReadTokens: parsed.usage.cache_read_input_tokens ?? null,
      model: parsed.model,
      latencyMs: Date.now() - started,
    };
  }

  /**
   * One turn of a tool-use conversation. `messages` is the full message history
   * as a JSON array (the caller manages the loop and appends tool_result
   * messages between calls).
   */
  async chatWithTools(
    model: string,
    system: string,
    messages: unknown,
    tools: ToolDef[],
  ): Promise<AssistantTurn> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(backoffMs(attempt));
      }
      try {
        return await this.chatWithToolsOnce(model, system, messages, tools);
      } catch (e) {
        if (!isTransientAnthropicError(e)) throw e;
        lastErr = e;
      }
    }
    throw lastErr ?? internal("anthropic chat_with_tools: retries exhausted (no error captured)");
  }

  private async chatWithToolsOnce(
    model: string,
    system: string,
    messages: unknown,
    tools: ToolDef[],
  ): Promise<AssistantTurn> {
    const toolsJson = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
    const payload = {
      model,
      max_tokens: DEFAULT_MAX_TOKENS,
      system,
      messages,
      tools: toolsJson,
    };

    const resp = await this.post(payload);

    if (!resp.ok) await this.handleErrorStatus(resp);

    let parsed: MessagesResponse;
    try {
      parsed = (await resp.json()) as MessagesResponse;
    } catch (e) {
      throw internal(`anthropic parse: ${e instanceof Error ? e.message : String(e)}`);
    }

    const blocks: AssistantBlock[] = [];
    for (const b of parsed.content) {
      if (b.type === "text") {
        blocks.push({ kind: "text", text: b.text ?? "" });
      } else if (b.type === "tool_use") {
        blocks.push({
          kind: "tool_use",
          id: b.id ?? "",
          name: b.name ?? "",
          input: b.input ?? null,
        });
      }
    }

    return new AssistantTurn(
      blocks,
      parsed.stop_reason ?? null,
      parsed.usage.input_tokens,
      parsed.usage.output_tokens,
    );
  }
}
