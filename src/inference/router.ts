// Per-phase provider routing. Each instance maps the six loop phases to a
// provider (Anthropic | OpenAI | Gemini); the model for each provider comes from
// global settings. Every call is governed (budget / rate-limits / breaker).
//
// `call()` takes a `DB` directly (not an AppState), matching the synchronous
// better-sqlite3 persistence layer.

import { internal, missingConfig } from "../error.ts";
import type { DB } from "../persistence/db.ts";
import { AnthropicClient } from "./anthropic.ts";
import { Governor } from "./governor/index.ts";
import { OpenAiClient } from "./openai.ts";
import {
  type Provider,
  type ProviderClient,
  providerForPhase,
  providersUsed,
} from "./provider.ts";
import type { ChatResponse, Phase } from "./index.ts";

/**
 * Everything `Router.build` needs, assembled by the caller from Settings +
 * the secret store. Keeps `inference` decoupled from `persistence`.
 */
export interface RouterConfig {
  routingMode: string;
  phaseRoutingJson: string | null;
  anthropicBaseUrl: string;
  anthropicModel: string;
  anthropicKey: string | null;
  openaiBaseUrl: string;
  openaiModel: string;
  openaiKey: string | null;
  geminiBaseUrl: string;
  geminiModel: string;
  geminiKey: string | null;
}

/** The parts of a prompt the router forwards to the governor. */
export interface PromptParts {
  system: string;
  stableUser: string;
  dynamicUser: string;
}

/**
 * Holds the configured clients + models for the providers an instance actually
 * uses, plus the routing resolution.
 */
export class Router {
  private constructor(
    private routingMode: string,
    private phaseRoutingJson: string | null,
    private clients: Map<Provider, ProviderClient>,
    private models: Map<Provider, string>,
  ) {}

  static build(cfg: RouterConfig): Router {
    const used = providersUsed(cfg.routingMode, cfg.phaseRoutingJson);
    const clients = new Map<Provider, ProviderClient>();
    const models = new Map<Provider, string>();

    for (const p of used) {
      switch (p) {
        case "anthropic": {
          if (!cfg.anthropicKey) {
            throw missingConfig(
              "Anthropic API key not set. Open Settings and save your key, or route these " +
                "phases to another provider.",
            );
          }
          clients.set(p, {
            kind: "anthropic",
            client: new AnthropicClient(cfg.anthropicBaseUrl, cfg.anthropicKey),
          });
          models.set(p, cfg.anthropicModel);
          break;
        }
        case "openai": {
          if (!cfg.openaiKey) {
            throw missingConfig(
              "OpenAI API key not set. Open Settings and save your key, or route these phases " +
                "to another provider.",
            );
          }
          clients.set(p, {
            kind: "openai-compat",
            client: new OpenAiClient(cfg.openaiBaseUrl, cfg.openaiKey),
          });
          models.set(p, cfg.openaiModel);
          break;
        }
        case "gemini": {
          if (!cfg.geminiKey) {
            throw missingConfig(
              "Gemini API key not set. Open Settings and save your key, or route these phases " +
                "to another provider.",
            );
          }
          clients.set(p, {
            kind: "openai-compat",
            client: new OpenAiClient(cfg.geminiBaseUrl, cfg.geminiKey),
          });
          models.set(p, cfg.geminiModel);
          break;
        }
      }
    }

    return new Router(cfg.routingMode, cfg.phaseRoutingJson, clients, models);
  }

  private providerFor(phase: Phase): Provider {
    return providerForPhase(this.routingMode, this.phaseRoutingJson, phase);
  }

  /**
   * All key-presence checks happen in `build`; nothing else to verify before a
   * run. Lightweight — no network calls. Kept for call-site symmetry.
   */
  async preflight(): Promise<void> {
    // `build` already threw if any used provider lacked a key. Re-assert that
    // every provider we resolved has a configured client (defensive).
    for (const p of providersUsed(this.routingMode, this.phaseRoutingJson)) {
      if (!this.clients.has(p)) {
        throw missingConfig(`no configured client for provider ${p}`);
      }
    }
  }

  modelFor(phase: Phase): string {
    const p = this.providerFor(phase);
    return this.models.get(p) ?? "";
  }

  providerName(phase: Phase): Provider {
    return this.providerFor(phase);
  }

  async call(
    phase: Phase,
    parts: PromptParts,
    instanceId: string,
    governor: Governor,
    db: DB,
  ): Promise<ChatResponse> {
    const provider = this.providerFor(phase);
    const client = this.clients.get(provider);
    if (!client) {
      throw internal(`router: no configured client for provider ${provider}`);
    }
    const model = this.models.get(provider) ?? "";
    return governor.governedChat(
      db,
      client,
      provider,
      instanceId,
      model,
      parts.system,
      parts.stableUser,
      parts.dynamicUser,
    );
  }
}
