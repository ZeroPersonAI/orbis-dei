// Settings live in the `settings` key/value table; lists are newline-joined,
// booleans are "true"/"false".
import type { DB } from "./db.ts";

export interface Settings {
  anthropic_model: string;
  anthropic_base_url: string;
  openai_model: string;
  openai_base_url: string;
  gemini_model: string;
  gemini_base_url: string;
  default_routing_mode: string;
  governor_rpm: number;
  governor_itpm: number;
  governor_otpm: number;
  daily_budget_usd: number;
  monthly_budget_usd: number;
  per_instance_quota_pct: number | null;
  max_concurrent_daemons: number;
  boredom_threshold: number;
  allow_tool_execution: boolean;
  network_access: string; // "off" | "gated" | "open"
  network_allowlist: string[];
  telegram_enabled: boolean;
  telegram_default_instance: string | null;
  telegram_authorized_chats: string[];
  telegram_allow_stimulus_inject: boolean;
}

// Patch: a key being absent = leave unchanged. `per_instance_quota_pct` and
// `telegram_default_instance` accept null to clear.
export type SettingsPatch = Partial<{
  anthropic_model: string;
  anthropic_base_url: string;
  openai_model: string;
  openai_base_url: string;
  gemini_model: string;
  gemini_base_url: string;
  default_routing_mode: string;
  governor_rpm: number;
  governor_itpm: number;
  governor_otpm: number;
  daily_budget_usd: number;
  monthly_budget_usd: number;
  per_instance_quota_pct: number | null;
  max_concurrent_daemons: number;
  boredom_threshold: number;
  allow_tool_execution: boolean;
  network_access: string;
  network_allowlist: string[];
  telegram_enabled: boolean;
  telegram_default_instance: string | null;
  telegram_authorized_chats: string[];
  telegram_allow_stimulus_inject: boolean;
}>;

const K = {
  ANTHROPIC_MODEL: "anthropic_model",
  ANTHROPIC_BASE_URL: "anthropic_base_url",
  OPENAI_MODEL: "openai_model",
  OPENAI_BASE_URL: "openai_base_url",
  GEMINI_MODEL: "gemini_model",
  GEMINI_BASE_URL: "gemini_base_url",
  DEFAULT_ROUTING_MODE: "default_routing_mode",
  GOV_RPM: "governor_rpm",
  GOV_ITPM: "governor_itpm",
  GOV_OTPM: "governor_otpm",
  DAILY_BUDGET: "daily_budget_usd",
  MONTHLY_BUDGET: "monthly_budget_usd",
  PER_INSTANCE_QUOTA: "per_instance_quota_pct",
  MAX_CONCURRENT_DAEMONS: "max_concurrent_daemons",
  BOREDOM_THRESHOLD: "boredom_threshold",
  ALLOW_TOOL_EXECUTION: "allow_tool_execution",
  NETWORK_ACCESS: "network_access",
  NETWORK_ALLOWLIST: "network_allowlist",
  TELEGRAM_ENABLED: "telegram_enabled",
  TELEGRAM_DEFAULT_INSTANCE: "telegram_default_instance",
  TELEGRAM_AUTHORIZED_CHATS: "telegram_authorized_chats",
  TELEGRAM_ALLOW_STIMULUS_INJECT: "telegram_allow_stimulus_inject",
} as const;

export function defaultSettings(): Settings {
  return {
    anthropic_model: "claude-opus-4-7",
    anthropic_base_url: "https://api.anthropic.com",
    openai_model: "gpt-4o",
    openai_base_url: "https://api.openai.com/v1",
    gemini_model: "gemini-2.5-flash",
    gemini_base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    default_routing_mode: "anthropic",
    governor_rpm: 50,
    governor_itpm: 30_000,
    governor_otpm: 8_000,
    daily_budget_usd: 5.0,
    monthly_budget_usd: 50.0,
    per_instance_quota_pct: null,
    max_concurrent_daemons: 3,
    boredom_threshold: 50,
    allow_tool_execution: false,
    network_access: "off",
    network_allowlist: [],
    telegram_enabled: false,
    telegram_default_instance: null,
    telegram_authorized_chats: [],
    telegram_allow_stimulus_inject: false,
  };
}

function getRaw(db: DB, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

function setRaw(db: DB, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, new Date().toISOString());
}

function delRaw(db: DB, key: string): void {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

const num = (db: DB, key: string, def: number): number => {
  const v = getRaw(db, key);
  if (v === null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const bool = (db: DB, key: string, def: boolean): boolean => {
  const v = getRaw(db, key);
  return v === null ? def : v === "true";
};
const str = (db: DB, key: string, def: string): string => getRaw(db, key) ?? def;
const list = (db: DB, key: string): string[] => {
  const v = getRaw(db, key);
  if (!v) return [];
  return v.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
};

export function loadSettings(db: DB): Settings {
  const d = defaultSettings();
  const quotaRaw = getRaw(db, K.PER_INSTANCE_QUOTA);
  const tgDefaultRaw = getRaw(db, K.TELEGRAM_DEFAULT_INSTANCE);
  return {
    anthropic_model: str(db, K.ANTHROPIC_MODEL, d.anthropic_model),
    anthropic_base_url: str(db, K.ANTHROPIC_BASE_URL, d.anthropic_base_url),
    openai_model: str(db, K.OPENAI_MODEL, d.openai_model),
    openai_base_url: str(db, K.OPENAI_BASE_URL, d.openai_base_url),
    gemini_model: str(db, K.GEMINI_MODEL, d.gemini_model),
    gemini_base_url: str(db, K.GEMINI_BASE_URL, d.gemini_base_url),
    default_routing_mode: str(db, K.DEFAULT_ROUTING_MODE, d.default_routing_mode),
    governor_rpm: num(db, K.GOV_RPM, d.governor_rpm),
    governor_itpm: num(db, K.GOV_ITPM, d.governor_itpm),
    governor_otpm: num(db, K.GOV_OTPM, d.governor_otpm),
    daily_budget_usd: num(db, K.DAILY_BUDGET, d.daily_budget_usd),
    monthly_budget_usd: num(db, K.MONTHLY_BUDGET, d.monthly_budget_usd),
    per_instance_quota_pct:
      quotaRaw === null ? null : Number.isFinite(Number(quotaRaw)) ? Number(quotaRaw) : null,
    max_concurrent_daemons: num(db, K.MAX_CONCURRENT_DAEMONS, d.max_concurrent_daemons),
    boredom_threshold: num(db, K.BOREDOM_THRESHOLD, d.boredom_threshold),
    allow_tool_execution: bool(db, K.ALLOW_TOOL_EXECUTION, d.allow_tool_execution),
    network_access: str(db, K.NETWORK_ACCESS, d.network_access),
    network_allowlist: list(db, K.NETWORK_ALLOWLIST),
    telegram_enabled: bool(db, K.TELEGRAM_ENABLED, d.telegram_enabled),
    telegram_default_instance: tgDefaultRaw,
    telegram_authorized_chats: list(db, K.TELEGRAM_AUTHORIZED_CHATS),
    telegram_allow_stimulus_inject: bool(
      db,
      K.TELEGRAM_ALLOW_STIMULUS_INJECT,
      d.telegram_allow_stimulus_inject,
    ),
  };
}

function sanitizeAllowlist(items: string[]): string[] {
  return items
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !s.includes("/") && !s.includes("*") && !s.includes(":"));
}

function sanitizeChats(items: string[]): string[] {
  return items
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => /^-?\d+$/.test(s));
}

export function applyPatch(db: DB, patch: SettingsPatch): void {
  const has = (k: keyof SettingsPatch) => Object.prototype.hasOwnProperty.call(patch, k);

  if (has("anthropic_model")) setRaw(db, K.ANTHROPIC_MODEL, String(patch.anthropic_model));
  if (has("anthropic_base_url")) setRaw(db, K.ANTHROPIC_BASE_URL, String(patch.anthropic_base_url));
  if (has("openai_model")) setRaw(db, K.OPENAI_MODEL, String(patch.openai_model));
  if (has("openai_base_url")) setRaw(db, K.OPENAI_BASE_URL, String(patch.openai_base_url));
  if (has("gemini_model")) setRaw(db, K.GEMINI_MODEL, String(patch.gemini_model));
  if (has("gemini_base_url")) setRaw(db, K.GEMINI_BASE_URL, String(patch.gemini_base_url));
  if (has("default_routing_mode"))
    setRaw(db, K.DEFAULT_ROUTING_MODE, String(patch.default_routing_mode));
  if (has("governor_rpm")) setRaw(db, K.GOV_RPM, String(patch.governor_rpm));
  if (has("governor_itpm")) setRaw(db, K.GOV_ITPM, String(patch.governor_itpm));
  if (has("governor_otpm")) setRaw(db, K.GOV_OTPM, String(patch.governor_otpm));
  if (has("daily_budget_usd")) setRaw(db, K.DAILY_BUDGET, String(patch.daily_budget_usd));
  if (has("monthly_budget_usd")) setRaw(db, K.MONTHLY_BUDGET, String(patch.monthly_budget_usd));
  if (has("per_instance_quota_pct")) {
    const v = patch.per_instance_quota_pct;
    if (v === null || v === undefined) delRaw(db, K.PER_INSTANCE_QUOTA);
    else setRaw(db, K.PER_INSTANCE_QUOTA, String(v));
  }
  if (has("max_concurrent_daemons"))
    setRaw(db, K.MAX_CONCURRENT_DAEMONS, String(patch.max_concurrent_daemons));
  if (has("boredom_threshold")) setRaw(db, K.BOREDOM_THRESHOLD, String(patch.boredom_threshold));
  if (has("allow_tool_execution"))
    setRaw(db, K.ALLOW_TOOL_EXECUTION, patch.allow_tool_execution ? "true" : "false");
  if (has("network_access")) setRaw(db, K.NETWORK_ACCESS, String(patch.network_access));
  if (has("network_allowlist"))
    setRaw(db, K.NETWORK_ALLOWLIST, sanitizeAllowlist(patch.network_allowlist ?? []).join("\n"));
  if (has("telegram_enabled"))
    setRaw(db, K.TELEGRAM_ENABLED, patch.telegram_enabled ? "true" : "false");
  if (has("telegram_default_instance")) {
    const v = patch.telegram_default_instance;
    if (v === null || v === undefined || v === "") delRaw(db, K.TELEGRAM_DEFAULT_INSTANCE);
    else setRaw(db, K.TELEGRAM_DEFAULT_INSTANCE, String(v));
  }
  if (has("telegram_authorized_chats"))
    setRaw(
      db,
      K.TELEGRAM_AUTHORIZED_CHATS,
      sanitizeChats(patch.telegram_authorized_chats ?? []).join("\n"),
    );
  if (has("telegram_allow_stimulus_inject"))
    setRaw(
      db,
      K.TELEGRAM_ALLOW_STIMULUS_INJECT,
      patch.telegram_allow_stimulus_inject ? "true" : "false",
    );
}
