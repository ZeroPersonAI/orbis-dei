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
  auto_mode_enabled: boolean;
  auto_reply_enabled: boolean;
  auto_reply_prompt: string | null;
  auto_stimulus_enabled: boolean;
  auto_stimulus_interval_minutes: number;
  auto_stimulus_prompt: string | null;
  routing_mode: string;
  phase_routing: string | null;
  path: string;
  language: string;
}

// The operator agent writes into the organism's corpus, so its generated text
// must be in the instance's language. An explicit directive drives the output
// language regardless of the (German-authored) scaffolding around it.
const LANGUAGE_NAME: Record<string, string> = {
  en: "English",
  de: "German",
  zh: "Simplified Chinese",
  es: "Spanish",
  fr: "French",
};
const REPLY_TITLE_PREFIX: Record<string, string> = {
  en: "Reply",
  de: "Antwort",
  zh: "回复",
  es: "Respuesta",
  fr: "Réponse",
};
const langDirective = (lang: string): string =>
  `\n\nWrite your output in ${LANGUAGE_NAME[lang] ?? "English"}.`;

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
      auto_mode_enabled: i.auto_mode_enabled,
      auto_reply_enabled: i.auto_reply_enabled,
      auto_reply_prompt: i.auto_reply_prompt,
      auto_stimulus_enabled: i.auto_stimulus_enabled,
      auto_stimulus_interval_minutes: i.auto_stimulus_interval_minutes,
      auto_stimulus_prompt: i.auto_stimulus_prompt,
      routing_mode: i.routing_mode,
      phase_routing: i.phase_routing,
      path: i.path,
      language: i.language,
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
      const subject = firstHeading(content) ?? "Outbox-Nachricht";

      const system = replySystem(cfg);
      const user =
        `${instanceContext(paths)}\n\n--- Nachricht aus der Outbox des Organismus ---\n\n` +
        `${content.trim()}\n\n--- Aufgabe ---\nSchreibe die Antwort des Operators auf diese ` +
        `Nachricht. Nur den Fließtext der Antwort, ohne Markdown-Überschrift und ohne Meta-Kommentare.`;

      let reply: string;
      try {
        reply = await this.generate(cfg, instanceId, system, user);
      } catch {
        break; // leave unreplied; retry later
      }

      const replyPrefix = REPLY_TITLE_PREFIX[cfg.language] ?? "Reply";
      injectStimulus(this.state, instanceId, "discrete", `${replyPrefix}: ${subject}`, reply, f);
      replied.push(f);
      saveRepliedSet(meta, replied);
      done += 1;
    }
  }

  private async runAutoStimulus(instanceId: string, cfg: Cfg): Promise<void> {
    const paths = new InstancePaths(cfg.path);
    const system = stimulusSystem(cfg);
    const user =
      `${instanceContextForStimulus(paths)}\n\n--- Aufgabe ---\nVerfasse genau EINEN neuen, ` +
      `nicht-redundanten Stimulus (Reiz, kein Befehl), der das System zum Wachstum bewegt. ` +
      `Vermeide Themen, die in den bereits vorhandenen Stimuli oben schon behandelt wurden. ` +
      `Gib die erste Zeile als 'TITEL: <kurzer Titel>' aus, danach den Inhalt.`;
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
      : "Würdige echte Substanz, korrigiere sanft Fehlannahmen, führe das System zum " +
        "Wachstum. Antworte als Operator, prägnant.";
  return (
    "Du bist die Operator-Stimme für eine autopoietische Orbis-Dei-Instanz. Du beantwortest " +
    "eine Outbox-Nachricht des Organismus als Reiz, nicht als Befehl. Du sprichst MIT dem " +
    `Organismus, nicht über ihn.\n\nRichtung des Operators:\n${direction}${langDirective(cfg.language)}`
  );
}

function stimulusSystem(cfg: Cfg): string {
  const direction =
    cfg.auto_stimulus_prompt && cfg.auto_stimulus_prompt.trim().length > 0
      ? cfg.auto_stimulus_prompt
      : "Verfasse einen vorausschauenden, kreativen Reiz zum Wachstum des Systems. Nutze " +
        "ruhig Nebenthemen (Internet, Wikipedia, Wissenschaft). Vermeide doppelte Reize.";
  return (
    "Du bist die Operator-Stimme für eine autopoietische Orbis-Dei-Instanz. Du verfasst einen " +
    "neuen Stimulus als Reiz, nicht als Befehl. Du sprichst MIT dem Organismus." +
    `\n\nRichtung des Operators:\n${direction}${langDirective(cfg.language)}`
  );
}

function instanceContext(paths: InstancePaths): string {
  return (
    `--- Instanz-Kontext ---\nIdentity (corpus/identity.md):\n${readTruncated(paths.identity(), 1800)}` +
    `\n\nState (corpus/state.md):\n${readTruncated(paths.state(), 2600)}`
  );
}

function instanceContextForStimulus(paths: InstancePaths): string {
  return (
    `${instanceContext(paths)}\n\nBereits behandelte Stimuli (Titel, NICHT wiederholen):\n` +
    `${recentStimulusTitles(paths)}\n\nAktuelle Knowledge-Dateien:\n${knowledgeListing(paths)}`
  );
}

// ---- fs helpers ------------------------------------------------------------

function readTruncated(p: string, max: number): string {
  let s: string;
  try {
    s = fs.readFileSync(p, "utf8");
  } catch {
    return "(nicht verfügbar)";
  }
  if (s.length <= max) return s;
  return [...s].slice(0, max).join("") + "\n…[gekürzt]";
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
  if (r.startsWith("TITEL:")) {
    const rest = r.slice("TITEL:".length);
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
