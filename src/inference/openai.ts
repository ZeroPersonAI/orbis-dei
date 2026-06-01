// OpenAI-compatible chat client.
// Used for BOTH OpenAI and Google Gemini (Gemini exposes an OpenAI-compatible
// endpoint at https://generativelanguage.googleapis.com/v1beta/openai).
//
// The `baseUrl` is expected to already include the version path; this client
// appends `/chat/completions`. There is no prompt-caching split — the caller's
// `system` + concatenated `user` message are sent fresh each call.

import { AppError, internal, rateLimited } from "../error.ts";
import { type ChatResponse, DEFAULT_MAX_TOKENS } from "./index.ts";

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 600_000;

function backoffMs(attempt: number): number {
  const secs = Math.min(Math.pow(3, Math.max(0, attempt - 1)), 30);
  return secs * 1000;
}

function isTransient(e: unknown): boolean {
  if (e instanceof AppError && e.kind === "internal") {
    return e.message.includes("openai HTTP 5") || e.message.includes("openai request:");
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ChatCompletion {
  model?: string;
  choices: Choice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

interface Choice {
  message: { content?: string | null };
  finish_reason?: string | null;
}

export class OpenAiClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  /**
   * POST {baseUrl}/chat/completions with a single system + user message.
   * Retries transient 5xx / network errors with exponential backoff.
   */
  async chat(model: string, system: string, user: string): Promise<ChatResponse> {
    let attempt = 0;
    // attempt starts at 1, retries while <= MAX_RETRIES.
    for (;;) {
      attempt += 1;
      try {
        return await this.chatOnce(model, system, user);
      } catch (e) {
        if (attempt <= MAX_RETRIES && isTransient(e)) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw e;
      }
    }
  }

  private async chatOnce(model: string, system: string, user: string): Promise<ChatResponse> {
    const started = Date.now();
    const url = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const payload = {
      model,
      max_tokens: DEFAULT_MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (e) {
      throw internal(`openai request: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      clearTimeout(timer);
    }

    const status = resp.status;
    if (status === 429) {
      const ra = resp.headers.get("retry-after");
      const retryAfterSecs = ra !== null && /^\d+$/.test(ra.trim()) ? Number(ra.trim()) : null;
      const body = await resp.text().catch(() => "");
      throw rateLimited(body, retryAfterSecs);
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw internal(`openai HTTP ${status}: ${body}`);
    }

    let parsed: ChatCompletion;
    try {
      parsed = (await resp.json()) as ChatCompletion;
    } catch (e) {
      throw internal(`openai parse: ${e instanceof Error ? e.message : String(e)}`);
    }

    const content = parsed.choices?.[0]?.message?.content ?? "";

    if (content.trim().length === 0) {
      const reason = parsed.choices?.[0]?.finish_reason ?? "unknown";
      throw internal(`openai returned empty content (finish_reason: ${reason})`);
    }

    const usage = parsed.usage ?? null;
    const inT = usage ? (usage.prompt_tokens ?? 0) : null;
    const outT = usage ? (usage.completion_tokens ?? 0) : null;

    return {
      content,
      inputTokens: inT,
      outputTokens: outT,
      cacheCreateTokens: null,
      cacheReadTokens: null,
      model: parsed.model ?? model,
      latencyMs: Date.now() - started,
    };
  }
}
