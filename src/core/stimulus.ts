// Operator stimulus injection + listings + outbox threads. Pure functions over
// AppState so commands, the
// auto-mode operator, and the Telegram bot can all call them.
import * as fs from "node:fs";
import * as path from "node:path";
import type { AppState } from "../state.ts";
import { InstancePaths, writeAtomic } from "../persistence/fs.ts";
import * as instance from "./instance.ts";
import { invalidInput, notFound } from "../error.ts";

const KNOWLEDGE_MAX_BYTES = 100 * 1024;
const REPLY_TO_PREFIX = "Reply-To: stimuli/outbox/";
const READ_OUTBOX_KEY = "read_outbox";

export type StimulusKind = "discrete" | "standing" | "knowledge";

export interface StimulusEntry {
  name: string;
  category: string;
  modified_at: string;
  preview: string;
}

function pathsFor(state: AppState, id: string): InstancePaths {
  return new InstancePaths(instance.pathOf(state.db, id));
}

/** lowercase ASCII alphanumerics + hyphens, no `..`/separators, max 60 chars. */
export function slugify(title: string): string {
  let s = title
    .toLowerCase()
    .split("")
    .map((c) => (/[a-z0-9]/.test(c) ? c : "-"))
    .join("");
  while (s.includes("--")) s = s.replace(/--/g, "-");
  const truncated = s.replace(/^-+|-+$/g, "").slice(0, 60);
  const cleaned = truncated.replace(/^-+|-+$/g, "");
  return cleaned.length === 0 ? "stimulus" : cleaned;
}

function stampCompact(d: Date): string {
  // UTC YYYYMMDD-HHMMSS.
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

export function injectStimulus(
  state: AppState,
  id: string,
  kind: StimulusKind,
  title: string,
  body: string,
  replyTo: string | null,
): string {
  const t = title.trim();
  if (t.length === 0) throw invalidInput("stimulus title must not be empty");

  const paths = pathsFor(state, id);

  let replyTarget: string | null = null;
  if (replyTo) {
    const rt = replyTo.trim();
    if (rt.length > 0) {
      if (rt.includes("..") || rt.includes("/") || rt.includes("\\")) {
        throw invalidInput("invalid reply_to name (bare filename only)");
      }
      const candidate = path.join(paths.stimuliOutbox(), rt);
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
        throw notFound(`outbox message ${rt} not found`);
      }
      replyTarget = rt;
    }
  }

  const baseSlug = slugify(t);
  const slug = replyTarget ? `re-${baseSlug}` : baseSlug;
  const now = new Date();

  let dir: string;
  let filename: string;
  switch (kind) {
    case "discrete":
      dir = paths.stimuliInbox();
      filename = `${stampCompact(now)}-${slug}.md`;
      break;
    case "standing":
      dir = paths.stimuliStanding();
      filename = `${slug}.md`;
      break;
    case "knowledge":
      dir = paths.knowledge();
      filename = `${slug}.md`;
      break;
  }

  const bodySection = replyTarget
    ? `Reply-To: stimuli/outbox/${replyTarget}\n\n## Antwort\n\n${body.trim()}\n`
    : `${body.trim()}\n`;
  const content = `# ${t}\n\n_injected by operator at ${now.toISOString()}_\n\n${bodySection}`;

  if (kind === "knowledge" && Buffer.byteLength(content) > KNOWLEDGE_MAX_BYTES) {
    throw invalidInput("knowledge stimulus exceeds the 100 KB SC-003 budget");
  }

  const full = path.join(dir, filename);
  writeAtomic(full, content);

  state.db
    .prepare(
      `UPDATE instances SET loops_since_last_stimulus = 0, last_stimulus_at = ? WHERE id = ?`,
    )
    .run(now.toISOString(), id);

  return path.relative(paths.root, full);
}

function modifiedRfc3339(p: string): string {
  try {
    return fs.statSync(p).mtime.toISOString();
  } catch {
    return "";
  }
}

function entriesIn(dir: string, category: string): StimulusEntry[] {
  const out: StimulusEntry[] = [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const p = path.join(dir, name);
    let isFile = false;
    try {
      isFile = fs.statSync(p).isFile();
    } catch {
      continue;
    }
    if (!isFile) continue;
    let content = "";
    try {
      content = fs.readFileSync(p, "utf8");
    } catch {
      content = "";
    }
    out.push({
      name,
      category,
      modified_at: modifiedRfc3339(p),
      preview: [...content].slice(0, 200).join(""),
    });
  }
  return out;
}

export function listInbox(state: AppState, id: string): StimulusEntry[] {
  return entriesIn(pathsFor(state, id).stimuliInbox(), "inbox").sort((a, b) =>
    b.name.localeCompare(a.name),
  );
}

export function listStanding(state: AppState, id: string): StimulusEntry[] {
  return entriesIn(pathsFor(state, id).stimuliStanding(), "standing").sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function listOutbox(state: AppState, id: string): StimulusEntry[] {
  return entriesIn(pathsFor(state, id).stimuliOutbox(), "outbox").sort((a, b) =>
    b.name.localeCompare(a.name),
  );
}

export function listProcessed(state: AppState, id: string): StimulusEntry[] {
  const base = pathsFor(state, id).stimuliProcessed();
  const out: StimulusEntry[] = [];
  let subs: string[];
  try {
    subs = fs.readdirSync(base);
  } catch {
    return [];
  }
  for (const sub of subs) {
    const subPath = path.join(base, sub);
    try {
      if (fs.statSync(subPath).isDirectory()) out.push(...entriesIn(subPath, "processed"));
    } catch {
      /* ignore */
    }
  }
  return out.sort((a, b) => b.name.localeCompare(a.name));
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

export function readStimulus(state: AppState, id: string, category: string, name: string): string {
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw invalidInput("invalid stimulus name");
  }
  const paths = pathsFor(state, id);
  let p: string | null;
  switch (category) {
    case "inbox":
      p = path.join(paths.stimuliInbox(), name);
      break;
    case "standing":
      p = path.join(paths.stimuliStanding(), name);
      break;
    case "outbox":
      p = path.join(paths.stimuliOutbox(), name);
      break;
    case "processed":
      p = findInProcessed(paths.stimuliProcessed(), name);
      if (!p) throw notFound(`processed stimulus ${name}`);
      break;
    default:
      throw invalidInput("invalid stimulus category");
  }
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    throw notFound(`could not read stimulus: ${(e as Error).message}`);
  }
}

// ---- outbox threads (Messages tab) ----------------------------------------

export interface ReplyInfo {
  name: string;
  category: string;
  modified_at: string;
  content: string;
}

export interface OutboxThread {
  name: string;
  modified_at: string;
  content: string;
  replies: ReplyInfo[];
  read: boolean;
}

function extractReplyTo(content: string): string | null {
  const lines = content.split("\n").slice(0, 40);
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith(REPLY_TO_PREFIX)) return t.slice(REPLY_TO_PREFIX.length).trim();
  }
  return null;
}

function readOutboxSet(metaPath: string): string[] {
  try {
    const v = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const arr = v?.[READ_OUTBOX_KEY];
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
  } catch {
    /* ignore */
  }
  return [];
}

function saveReadOutboxSet(metaPath: string, names: string[]): void {
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    meta = {};
  }
  meta[READ_OUTBOX_KEY] = names;
  writeAtomic(metaPath, JSON.stringify(meta, null, 2));
}

function validateOutboxName(name: string): void {
  if (name.includes("/") || name.includes("\\") || name.includes("..") || name.length === 0) {
    throw invalidInput("invalid outbox name");
  }
}

export function listOutboxThreads(state: AppState, id: string): OutboxThread[] {
  const paths = pathsFor(state, id);
  const outboxDir = paths.stimuliOutbox();
  const threads: OutboxThread[] = [];
  if (!fs.existsSync(outboxDir)) return threads;

  const readSet = new Set(readOutboxSet(paths.orbisMeta()));

  let names: string[];
  try {
    names = fs.readdirSync(outboxDir);
  } catch {
    return threads;
  }
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const p = path.join(outboxDir, name);
    try {
      if (!fs.statSync(p).isFile()) continue;
    } catch {
      continue;
    }
    threads.push({
      name,
      modified_at: modifiedRfc3339(p),
      content: (() => {
        try {
          return fs.readFileSync(p, "utf8");
        } catch {
          return "";
        }
      })(),
      replies: [],
      read: readSet.has(name),
    });
  }
  threads.sort((a, b) => b.modified_at.localeCompare(a.modified_at));

  const idx = new Map<string, number>();
  threads.forEach((t, i) => idx.set(t.name, i));

  const scanReplies = (dir: string, category: string) => {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
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
      const target = extractReplyTo(content);
      if (target && idx.has(target)) {
        threads[idx.get(target)!].replies.push({
          name,
          category,
          modified_at: modifiedRfc3339(p),
          content,
        });
      }
    }
  };

  scanReplies(paths.stimuliInbox(), "inbox");
  // processed/{YYYY-MM}/
  try {
    for (const sub of fs.readdirSync(paths.stimuliProcessed())) {
      const subPath = path.join(paths.stimuliProcessed(), sub);
      try {
        if (fs.statSync(subPath).isDirectory()) scanReplies(subPath, "processed");
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  for (const t of threads) {
    t.replies.sort((a, b) => a.modified_at.localeCompare(b.modified_at));
  }
  return threads;
}

export function markOutboxRead(state: AppState, id: string, name: string): void {
  validateOutboxName(name);
  const meta = pathsFor(state, id).orbisMeta();
  const set = readOutboxSet(meta);
  if (!set.includes(name)) {
    set.push(name);
    saveReadOutboxSet(meta, set);
  }
}

export function markOutboxUnread(state: AppState, id: string, name: string): void {
  validateOutboxName(name);
  const meta = pathsFor(state, id).orbisMeta();
  const set = readOutboxSet(meta);
  const filtered = set.filter((n) => n !== name);
  if (filtered.length !== set.length) saveReadOutboxSet(meta, filtered);
}
