// The operator-agent. Two gated behaviours: auto-reply to new outbox messages
// and periodic auto-stimulus.
// Both write only into stimuli/ via injectStimulus (the operator carve-out).
import * as fs from "node:fs";
import * as path from "node:path";
import type { AppState } from "../state.ts";
import { InstancePaths, writeAtomic } from "../persistence/fs.ts";
import { loadSettings } from "../persistence/settings.ts";
import { Router, type RouterConfig } from "../inference/router.ts";
import type { Phase } from "../inference/index.ts";
import * as instance from "./instance.ts";
import { injectStimulus } from "./stimulus.ts";
import { CancellationToken } from "../util/cancel.ts";

const POLL_TICK_SECS = 30;
const MAX_REPLIES_PER_TICK = 2;
const GEN_PHASE: Phase = "elect";
const REPLIED_KEY = "auto_replied_outbox";

interface Cfg {
  status: string;
  auto_mode_enabled: boolean;
  auto_reply_enabled: boolean;
  auto_reply_prompt: string | null;
  auto_stimulus_enabled: boolean;
  auto_stimulus_interval_minutes: number;
  auto_stimulus_prompt: string | null;
  routing_mode: string;
  phase_routing: string | null;
  path: string;
}

export class AutoModeManager {
  private handles = new Map<string, CancellationToken>();

  constructor(private state: AppState) {}

  isRunning(id: string): boolean {
    return this.handles.has(id);
  }

  async start(instanceId: string): Promise<void> {
    if (this.handles.has(instanceId)) return;
    const cancel = new CancellationToken();
    this.handles.set(instanceId, cancel);
    void this.autoBody(instanceId, cancel).finally(() => {
      // self-deregister when the body exits
      if (this.handles.get(instanceId) === cancel) this.handles.delete(instanceId);
    });
  }

  async stop(instanceId: string): Promise<void> {
    const h = this.handles.get(instanceId);
    if (h) {
      h.cancel();
      this.handles.delete(instanceId);
    }
  }

  /** On startup, resume auto-mode for every instance that had it enabled. */
  async resumeEnabled(): Promise<number> {
    let n = 0;
    for (const i of instance.listAll(this.state.db)) {
      if (i.auto_mode_enabled) {
        await this.start(i.id);
        n += 1;
      }
    }
    return n;
  }

  private loadCfg(id: string): Cfg {
    const i = instance.get(this.state.db, id);
    return {
      status: i.status,
      auto_mode_enabled: i.auto_mode_enabled,
      auto_reply_enabled: i.auto_reply_enabled,
      auto_reply_prompt: i.auto_reply_prompt,
      auto_stimulus_enabled: i.auto_stimulus_enabled,
      auto_stimulus_interval_minutes: i.auto_stimulus_interval_minutes,
      auto_stimulus_prompt: i.auto_stimulus_prompt,
      routing_mode: i.routing_mode,
      phase_routing: i.phase_routing,
      path: i.path,
    };
  }

  private async autoBody(instanceId: string, cancel: CancellationToken): Promise<void> {
    let lastStimulusAt = Date.now();

    while (!cancel.isCancelled) {
      let cfg: Cfg;
      try {
        cfg = this.loadCfg(instanceId);
      } catch {
        break;
      }
      if (!cfg.auto_mode_enabled) break;

      // Auto-mode is the operator for a *living* loop. While the instance is
      // not actively looping (paused, boredom, error, idle), stay armed but
      // dormant — don't inject stimuli that would only pile up unprocessed and
      // burn tokens. This resumes automatically once the daemon is running
      // again, with no restart needed.
      if (cfg.status !== "running") {
        await cancel.sleep(POLL_TICK_SECS * 1000);
        continue;
      }

      if (cfg.auto_reply_enabled) {
        try {
          await this.runAutoReply(instanceId, cfg);
        } catch {
          /* logged-equivalent: retry next tick */
        }
      }

      if (cfg.auto_stimulus_enabled) {
        const intervalMs = Math.max(1, cfg.auto_stimulus_interval_minutes) * 60 * 1000;
        if (Date.now() - lastStimulusAt >= intervalMs) {
          try {
            await this.runAutoStimulus(instanceId, cfg);
            lastStimulusAt = Date.now();
          } catch {
            /* retry next tick */
          }
        }
      }

      await cancel.sleep(POLL_TICK_SECS * 1000);
    }
  }

  private buildRouter(cfg: Cfg): Router {
    const s = loadSettings(this.state.db);
    return Router.build({
      routingMode: cfg.routing_mode,
      phaseRoutingJson: cfg.phase_routing,
      anthropicBaseUrl: s.anthropic_base_url,
      anthropicModel: s.anthropic_model,
      anthropicKey: this.state.secrets.get("anthropic-api-key"),
      openaiBaseUrl: s.openai_base_url,
      openaiModel: s.openai_model,
      openaiKey: this.state.secrets.get("openai-api-key"),
      geminiBaseUrl: s.gemini_base_url,
      geminiModel: s.gemini_model,
      geminiKey: this.state.secrets.get("gemini-api-key"),
    } satisfies RouterConfig);
  }

  private async generate(cfg: Cfg, instanceId: string, system: string, user: string): Promise<string> {
    const router = this.buildRouter(cfg);
    const resp = await router.call(
      GEN_PHASE,
      { system, stableUser: "", dynamicUser: user },
      instanceId,
      this.state.governor,
      this.state.db,
    );
    const text = resp.content.trim();
    if (text.length === 0) throw new Error("auto-mode generation returned empty text");
    return text;
  }

  private async runAutoReply(instanceId: string, cfg: Cfg): Promise<void> {
    const paths = new InstancePaths(cfg.path);
    const meta = paths.orbisMeta();
    const replied = repliedSet(meta);

    const fresh = listOutboxFiles(paths).filter((f) => !replied.includes(f));

    let done = 0;
    for (const f of fresh) {
      if (done >= MAX_REPLIES_PER_TICK) break;
      let content = "";
      try {
        content = fs.readFileSync(path.join(paths.stimuliOutbox(), f), "utf8");
      } catch {
        content = "";
      }
      const subject = firstHeading(content) ?? "Outbox message";

      const system = replySystem(cfg);
      const user =
        `${instanceContext(paths)}\n\n--- Message from the organism's outbox ---\n\n` +
        `${content.trim()}\n\n--- Task ---\nWrite the operator's reply to this message. ` +
        `Only the prose of the reply, no Markdown heading, no meta-comments.`;

      let reply: string;
      try {
        reply = await this.generate(cfg, instanceId, system, user);
      } catch {
        break; // leave unreplied; retry later
      }

      injectStimulus(this.state, instanceId, "discrete", `Reply: ${subject}`, reply, f);
      replied.push(f);
      saveRepliedSet(meta, replied);
      done += 1;
    }
  }

  private async runAutoStimulus(instanceId: string, cfg: Cfg): Promise<void> {
    const paths = new InstancePaths(cfg.path);
    const system = stimulusSystem(cfg);
    const user =
      `${instanceContextForStimulus(paths)}\n\n--- Task ---\nCompose exactly ONE new, ` +
      `non-redundant stimulus (a trigger, not a command) that moves the system toward growth. ` +
      `Avoid topics already covered in the stimuli above. ` +
      `Output the first line as 'TITLE: <short title>', then the content.`;
    const raw = await this.generate(cfg, instanceId, system, user);
    const [title, body] = splitTitleBody(raw, "Auto-Stimulus");
    injectStimulus(this.state, instanceId, "discrete", title, body, null);
  }
}

// ---- prompt building -------------------------------------------------------

function replySystem(cfg: Cfg): string {
  const direction =
    cfg.auto_reply_prompt && cfg.auto_reply_prompt.trim().length > 0
      ? cfg.auto_reply_prompt
      : "Honour genuine substance, gently correct misconceptions, guide the system toward " +
        "growth. Reply as the operator, concise.";
  return (
    "You are the operator voice for an autopoietic Orbis Dei instance. You answer a message " +
    "from the organism's outbox as a stimulus, not a command. You speak WITH the organism, " +
    `not about it.\n\nOperator direction:\n${direction}`
  );
}

function stimulusSystem(cfg: Cfg): string {
  const direction =
    cfg.auto_stimulus_prompt && cfg.auto_stimulus_prompt.trim().length > 0
      ? cfg.auto_stimulus_prompt
      : "Compose a forward-looking, creative stimulus for the system's growth. Feel free to " +
        "draw on adjacent topics (the internet, Wikipedia, science). Avoid duplicate stimuli.";
  return (
    "You are the operator voice for an autopoietic Orbis Dei instance. You compose a new " +
    "stimulus as a trigger, not a command. You speak WITH the organism." +
    `\n\nOperator direction:\n${direction}`
  );
}

function instanceContext(paths: InstancePaths): string {
  return (
    `--- Instance context ---\nIdentity (corpus/identity.md):\n${readTruncated(paths.identity(), 1800)}` +
    `\n\nState (corpus/state.md):\n${readTruncated(paths.state(), 2600)}`
  );
}

function instanceContextForStimulus(paths: InstancePaths): string {
  return (
    `${instanceContext(paths)}\n\nStimuli already addressed (titles, do NOT repeat):\n` +
    `${recentStimulusTitles(paths)}\n\nCurrent knowledge files:\n${knowledgeListing(paths)}`
  );
}

// ---- fs helpers ------------------------------------------------------------

function readTruncated(p: string, max: number): string {
  let s: string;
  try {
    s = fs.readFileSync(p, "utf8");
  } catch {
    return "(not available)";
  }
  if (s.length <= max) return s;
  return [...s].slice(0, max).join("") + "\n…[truncated]";
}

function listOutboxFiles(paths: InstancePaths): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(paths.stimuliOutbox());
  } catch {
    return [];
  }
  return names
    .filter((n) => {
      try {
        return fs.statSync(path.join(paths.stimuliOutbox(), n)).isFile();
      } catch {
        return false;
      }
    })
    .filter((n) => !n.startsWith(".") && n.endsWith(".md"))
    .sort();
}

function firstHeading(content: string): string | null {
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t.startsWith("# ")) {
      const h = t.slice(2).trim();
      if (h.length > 0) return [...h].slice(0, 80).join("");
    }
  }
  return null;
}

function collectTitles(dir: string, out: string[]): void {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.endsWith(".md") || name.startsWith(".")) continue;
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
    out.push(firstHeading(content) ?? name);
  }
}

function recentStimulusTitles(paths: InstancePaths): string {
  const titles: string[] = [];
  collectTitles(paths.stimuliInbox(), titles);
  collectTitles(paths.stimuliStanding(), titles);
  try {
    for (const sub of fs.readdirSync(paths.stimuliProcessed())) {
      const subPath = path.join(paths.stimuliProcessed(), sub);
      try {
        if (fs.statSync(subPath).isDirectory()) collectTitles(subPath, titles);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  const unique = [...new Set(titles)].sort();
  if (unique.length === 0) return "(keine)";
  return [...unique.map((t) => `- ${t}`).join("\n")].slice(0, 2000).join("");
}

function knowledgeListing(paths: InstancePaths): string {
  let names: string[];
  try {
    names = fs.readdirSync(paths.knowledge());
  } catch {
    return "(keine)";
  }
  const md = names
    .filter((n) => {
      try {
        return fs.statSync(path.join(paths.knowledge(), n)).isFile();
      } catch {
        return false;
      }
    })
    .filter((n) => n.endsWith(".md") && !n.startsWith("."))
    .sort();
  if (md.length === 0) return "(keine)";
  return md.map((n) => `- ${n}`).join("\n");
}

function splitTitleBody(raw: string, defaultTitle: string): [string, string] {
  const r = raw.trim();
  if (r.startsWith("TITLE:")) {
    const rest = r.slice("TITLE:".length);
    const nl = rest.indexOf("\n");
    const title = (nl >= 0 ? rest.slice(0, nl) : rest).trim();
    const body = (nl >= 0 ? rest.slice(nl + 1) : "").trim();
    if (title.length > 0 && body.length > 0) {
      return [[...title].slice(0, 80).join(""), body];
    }
  }
  const first = r.split("\n")[0] ?? defaultTitle;
  let title = [...first.replace(/^#+/, "").trim()].slice(0, 80).join("");
  if (title.length === 0) title = defaultTitle;
  return [title, r];
}

// ---- replied-set tracking --------------------------------------------------

function repliedSet(metaPath: string): string[] {
  try {
    const v = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const arr = v?.[REPLIED_KEY];
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
  } catch {
    /* ignore */
  }
  return [];
}

function saveRepliedSet(metaPath: string, set: string[]): void {
  let v: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (parsed && typeof parsed === "object") v = parsed;
  } catch {
    v = {};
  }
  v[REPLIED_KEY] = set;
  writeAtomic(metaPath, JSON.stringify(v, null, 2));
}
