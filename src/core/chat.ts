// Chat over telemetry. The model is a read-only window into the instance's
// files via tool calls; never the voice of
// the organism. Every tool here is read-only.
import * as fs from "node:fs";
import * as path from "node:path";
import type { AppState } from "../state.ts";
import { InstancePaths } from "../persistence/fs.ts";
import { loadSettings } from "../persistence/settings.ts";
import { AnthropicClient, type ToolDef } from "../inference/anthropic.ts";
import * as instance from "./instance.ts";
import { readCounter } from "./cycle/stateMd.ts";
import { computeUnanimousStreak } from "./cycle/electResult.ts";
import { invalidInput, missingConfig, internal } from "../error.ts";

const MAX_ITERATIONS = 6;
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_RESULT_BYTES = 8 * 1024;
const ELECT_WINDOW = 25;

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatTurn {
  reply: string;
  tools_used: string[];
}

const LANGUAGE_NAME: Record<string, string> = {
  en: "English",
  de: "German",
  zh: "Simplified Chinese",
  es: "Spanish",
  fr: "French",
};

function systemPrompt(uiLang: string): string {
  const lang = LANGUAGE_NAME[uiLang] ?? "English";
  return `You answer the operator's questions about a running Orbis Dei organism instance.

The instance is an autopoietic research organism with its own corpus (identity, state, episodic memory, knowledge, stimuli) and a six-phase /loop (observe, diverge, elect, expand, review, integrate). You are NOT the instance — you are a read-only window into its files. Speak in the third person ("The system has …", "The instance is working …"). Never say "I am Orbis Dei" or speak as if you were the organism. The architecture is a decentralized agent swarm with a corpus; it is not a single "I".

Use the provided tools to read actual files before answering. Prefer ground truth over guesses. If a tool returns an error or a field is not available, say so honestly — do not invent plausible-sounding details. Quote concrete numbers, file names, and excerpts from what you actually read.

Always write your reply in ${lang}. Keep answers tight and grounded in what the tools returned.`;
}

function cap(s: string): string {
  if (Buffer.byteLength(s) <= MAX_TOOL_RESULT_BYTES) return s;
  return [...s].slice(0, MAX_TOOL_RESULT_BYTES).join("") + "\n…[truncated]";
}

function toolDefinitions(): ToolDef[] {
  const empty = { type: "object", properties: {}, required: [] };
  return [
    { name: "read_state_md", description: "Read corpus/state.md — the instance's current self-state narrative, loop counter, recent decisions.", inputSchema: empty },
    { name: "read_identity", description: "Read corpus/identity.md — the immutable identity core (rarely changes; useful for context, not for current activity).", inputSchema: empty },
    { name: "list_episodic_files", description: "List the episodic file names under corpus/episodic/ (one per phase per loop, newest first).", inputSchema: empty },
    { name: "read_episodic_file", description: "Read one episodic file by name, e.g. 'loop-00012-elect.md'. The name must be a bare basename.", inputSchema: { type: "object", properties: { filename: { type: "string" } }, required: ["filename"] } },
    { name: "list_inbox", description: "List unprocessed stimuli waiting in stimuli/inbox/.", inputSchema: empty },
    { name: "list_standing", description: "List standing concerns (persistent stimuli) under stimuli/standing/.", inputSchema: empty },
    { name: "list_processed", description: "List recently archived stimuli under stimuli/processed/.", inputSchema: empty },
    { name: "read_stimulus", description: "Read one stimulus file in full. category must be 'inbox' | 'standing' | 'processed'; name is the bare filename.", inputSchema: { type: "object", properties: { category: { type: "string" }, name: { type: "string" } }, required: ["category", "name"] } },
    { name: "get_drift_metrics", description: "Get current drift indicators: tool_lag, unanimous_streak (SC-004 signal), and elect_markers_missing.", inputSchema: empty },
    { name: "recent_loop_events", description: "Return the most recent loop phase events. Optional 'limit' (default 30).", inputSchema: { type: "object", properties: { limit: { type: "integer" } }, required: [] } },
  ];
}

function listMdDir(dir: string): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => {
      try {
        return fs.statSync(path.join(dir, n)).isFile();
      } catch {
        return false;
      }
    })
    .filter((n) => n.toLowerCase().endsWith(".md"));
}

function stimulusListing(dir: string): string {
  if (!fs.existsSync(dir)) return "(none)";
  const out: string[] = [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return "(none)";
  }
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const p = path.join(dir, name);
    try {
      if (!fs.statSync(p).isFile()) continue;
    } catch {
      continue;
    }
    let content = "";
    try {
      content = fs.readFileSync(p, "utf8");
    } catch {
      content = "";
    }
    const preview = [...content].slice(0, 180).join("").replace(/\n/g, " ");
    out.push(`${name} :: ${preview}`);
  }
  out.sort();
  return out.length === 0 ? "(none)" : out.join("\n");
}

function processedListing(base: string): string {
  if (!fs.existsSync(base)) return "(none)";
  const out: string[] = [];
  let subs: string[];
  try {
    subs = fs.readdirSync(base);
  } catch {
    return "(none)";
  }
  for (const sub of subs) {
    const subPath = path.join(base, sub);
    try {
      if (!fs.statSync(subPath).isDirectory()) continue;
      for (const name of fs.readdirSync(subPath)) {
        if (fs.statSync(path.join(subPath, name)).isFile()) out.push(name);
      }
    } catch {
      /* ignore */
    }
  }
  out.sort();
  out.reverse();
  return out.length === 0 ? "(none)" : out.slice(0, 50).join("\n");
}

function findInProcessed(base: string, name: string): string | null {
  let subs: string[];
  try {
    subs = fs.readdirSync(base);
  } catch {
    return null;
  }
  for (const sub of subs) {
    const candidate = path.join(base, sub, name);
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function dispatchTool(
  paths: InstancePaths,
  state: AppState,
  instanceId: string,
  name: string,
  input: any,
): string {
  try {
    switch (name) {
      case "read_state_md":
        return cap(fs.readFileSync(paths.state(), "utf8"));
      case "read_identity":
        return cap(fs.readFileSync(paths.identity(), "utf8"));
      case "list_episodic_files": {
        const dir = paths.episodic();
        if (!fs.existsSync(dir)) return "(no episodic files yet)";
        const names = listMdDir(dir).sort().reverse();
        return cap(names.join("\n"));
      }
      case "read_episodic_file": {
        const filename = input?.filename;
        if (typeof filename !== "string") throw invalidInput("filename required");
        if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
          throw invalidInput("invalid filename");
        }
        return cap(fs.readFileSync(path.join(paths.episodic(), filename), "utf8"));
      }
      case "list_inbox":
        return cap(stimulusListing(paths.stimuliInbox()));
      case "list_standing":
        return cap(stimulusListing(paths.stimuliStanding()));
      case "list_processed":
        return cap(processedListing(paths.stimuliProcessed()));
      case "read_stimulus": {
        const category = input?.category;
        const fname = input?.name;
        if (typeof category !== "string") throw invalidInput("category required");
        if (typeof fname !== "string") throw invalidInput("name required");
        if (fname.includes("..") || fname.includes("/") || fname.includes("\\")) {
          throw invalidInput("invalid stimulus name");
        }
        let p: string | null;
        if (category === "inbox") p = path.join(paths.stimuliInbox(), fname);
        else if (category === "standing") p = path.join(paths.stimuliStanding(), fname);
        else if (category === "processed") {
          p = findInProcessed(paths.stimuliProcessed(), fname);
          if (!p) throw invalidInput(fname);
        } else throw invalidInput("invalid category");
        return cap(fs.readFileSync(p, "utf8"));
      }
      case "get_drift_metrics": {
        const loopN = (() => {
          try {
            return readCounter(paths.state());
          } catch {
            return 1;
          }
        })();
        let lastToolLoop = 1;
        try {
          const m = JSON.parse(fs.readFileSync(paths.orbisMeta(), "utf8"));
          if (typeof m?.last_tool_loop === "number") lastToolLoop = m.last_tool_loop;
        } catch {
          /* ignore */
        }
        const toolLag = Math.max(0, loopN - lastToolLoop);
        const streak = computeUnanimousStreak(paths.episodic(), ELECT_WINDOW);
        return cap(
          `loop_n: ${loopN}\ntool_lag: ${toolLag}\nlast_tool_loop: ${lastToolLoop}\n` +
            `unanimous_streak: ${streak.unanimousStreak}\nelect_markers_missing: ${streak.markersMissingInWindow}\n` +
            `elect_window: ${streak.window}`,
        );
      }
      case "recent_loop_events": {
        const limit = Math.max(1, Math.min(200, Number(input?.limit ?? 30)));
        const rows = state.db
          .prepare(
            `SELECT loop_n, phase, model_used, tokens_in, tokens_out, outcome, started_at, finished_at
             FROM loop_events WHERE instance_id = ? ORDER BY id DESC LIMIT ?`,
          )
          .all(instanceId, limit) as any[];
        return cap(
          rows
            .map(
              (r) =>
                `loop=${r.loop_n} phase=${JSON.stringify(r.phase)} model=${JSON.stringify(r.model_used)} ` +
                `in=${r.tokens_in} out=${r.tokens_out} outcome=${JSON.stringify(r.outcome)} ` +
                `started=${JSON.stringify(r.started_at)} finished=${JSON.stringify(r.finished_at)}`,
            )
            .join("\n"),
        );
      }
      default:
        throw invalidInput(`unknown tool: ${name}`);
    }
  } catch (e: any) {
    return `(tool error: ${e?.message ?? e})`;
  }
}

export async function chatAboutInstance(
  state: AppState,
  id: string,
  history: ChatMessage[],
  message: string,
  uiLang: string = "en",
): Promise<ChatTurn> {
  if (message.trim().length === 0) throw invalidInput("message must not be empty");

  const paths = new InstancePaths(instance.pathOf(state.db, id));
  const settings = loadSettings(state.db);
  const apiKey = state.secrets.get("anthropic-api-key");
  if (!apiKey) {
    throw missingConfig(
      "Anthropic API key not set. The chat-over-telemetry tab needs a remote model — open Settings to add one.",
    );
  }
  const client = new AnthropicClient(settings.anthropic_base_url, apiKey);
  const SYSTEM = systemPrompt(uiLang);

  const trimmed = history.slice(Math.max(0, history.length - MAX_HISTORY_MESSAGES));
  const messages: any[] = trimmed.map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: "user", content: message });

  const tools = toolDefinitions();
  const toolsUsed: string[] = [];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const turn = await client.chatWithTools(settings.anthropic_model, SYSTEM, messages, tools);
    const tuList = turn.toolUses();
    if (tuList.length === 0) {
      return { reply: turn.text(), tools_used: toolsUsed };
    }
    messages.push({ role: "assistant", content: turn.toMessageContent() });
    const toolResults: any[] = [];
    for (const tu of tuList) {
      const result = dispatchTool(paths, state, id, tu.name, tu.input);
      toolsUsed.push(tu.name);
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw internal(`chat tool-use loop exceeded ${MAX_ITERATIONS} iterations without producing a final reply`);
}
