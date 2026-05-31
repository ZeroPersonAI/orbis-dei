// Port of src-tauri/src/inference/provider.rs — provider-agnostic chat routing.
// `ProviderClient` is a discriminated union (not a trait) so the governor can
// drive any provider through one `chat()` entry point.

import { type AppError, invalidInput } from "../error.ts";
import { AnthropicClient } from "./anthropic.ts";
import { OpenAiClient } from "./openai.ts";
import type { ChatResponse } from "./index.ts";

/** The three supported remote providers. */
export type Provider = "anthropic" | "openai" | "gemini";

const PHASES = ["observe", "diverge", "elect", "expand", "review", "integrate"] as const;

/** Parse a provider string, or `null` if it is not one of the three. */
export function parseProvider(s: string): Provider | null {
  switch (s.trim().toLowerCase()) {
    case "anthropic":
      return "anthropic";
    case "openai":
      return "openai";
    case "gemini":
      return "gemini";
    default:
      return null;
  }
}

/**
 * A concrete, configured client for one provider. Anthropic keeps its native
 * prompt-caching split; OpenAI/Gemini concatenate the stable + dynamic halves
 * into one user message (no cache).
 */
export type ProviderClient =
  | { kind: "anthropic"; client: AnthropicClient }
  | { kind: "openai-compat"; client: OpenAiClient };

/**
 * Drive any provider through one entry point. Anthropic gets the 3 parts;
 * OpenAI/Gemini concatenate `stableUser` + "\n\n" + `dynamicUser` into the
 * single user message.
 */
export function chatVia(
  pc: ProviderClient,
  model: string,
  system: string,
  stableUser: string,
  dynamicUser: string,
): Promise<ChatResponse> {
  if (pc.kind === "anthropic") {
    return pc.client.chat(model, system, stableUser, dynamicUser);
  }
  const user = stableUser.length === 0 ? dynamicUser : `${stableUser}\n\n${dynamicUser}`;
  return pc.client.chat(model, system, user);
}

/**
 * Resolve a `routingMode` preset + optional per-phase JSON map into a concrete
 * provider for the given phase. `routingMode` is one of
 * `anthropic | openai | gemini | custom`. For `custom`, `phaseRoutingJson` is a
 * `{ "<phase>": "<provider>", ... }` map; missing/malformed entries fall back
 * to Anthropic.
 */
export function providerForPhase(
  routingMode: string,
  phaseRoutingJson: string | null,
  phase: string,
): Provider {
  if (routingMode.trim().toLowerCase() === "custom") {
    if (phaseRoutingJson) {
      try {
        const map = JSON.parse(phaseRoutingJson) as Record<string, unknown>;
        if (map && typeof map === "object" && !Array.isArray(map)) {
          const raw = map[phase];
          if (typeof raw === "string") {
            const p = parseProvider(raw);
            if (p) return p;
          }
        }
      } catch {
        // Malformed JSON falls through to the Anthropic fallback.
      }
    }
    return "anthropic";
  }
  return parseProvider(routingMode) ?? "anthropic";
}

/** All distinct providers referenced by a routing config (for the 6 phases). */
export function providersUsed(routingMode: string, phaseRoutingJson: string | null): Provider[] {
  const out: Provider[] = [];
  for (const ph of PHASES) {
    const p = providerForPhase(routingMode, phaseRoutingJson, ph);
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/** Validate a `routingMode` string (preset or "custom"). Throws on bad input. */
export function validateRoutingMode(s: string): void {
  const t = s.trim().toLowerCase();
  if (t === "custom" || parseProvider(t) !== null) return;
  const err: AppError = invalidInput(
    `unknown routing mode: ${s} (expected anthropic | openai | gemini | custom)`,
  );
  throw err;
}
