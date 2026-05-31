import { invoke } from "./transport";

export type Provider = "anthropic" | "openai" | "gemini";
export type RoutingMode = Provider | "custom";

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
};

export const ROUTING_MODE_LABELS: Record<RoutingMode, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  custom: "Custom (per phase)",
};

export const LOOP_PHASES = [
  "observe",
  "diverge",
  "elect",
  "expand",
  "review",
  "integrate",
] as const;

export interface Instance {
  id: string;
  name: string;
  path: string;
  created_at: string;
  status: string;
  current_phase: string | null;
  loop_counter: number;
  last_stimulus_at: string | null;
  routing_mode: RoutingMode;
  /** JSON map {"<phase>":"<provider>"} when routing_mode === "custom". */
  phase_routing: string | null;
  loops_since_last_stimulus: number;
}

export interface PhaseOutcome {
  phase: string;
  episodic_path: string;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number;
}

export interface LoopResult {
  instance_id: string;
  loop_n: number;
  phases: PhaseOutcome[];
  duration_ms: number;
  final_counter: number;
}

export interface PhaseEvent {
  instance_id: string;
  loop_n: number;
  phase: string;
  episodic_path: string | null;
}

export interface LoopFailedEvent {
  instance_id: string;
  loop_n: number;
  error: string;
}

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
  network_access: NetworkAccess;
  network_allowlist: string[];
  telegram_enabled: boolean;
  telegram_default_instance: string | null;
  telegram_authorized_chats: string[];
  telegram_allow_stimulus_inject: boolean;
}

export interface SettingsPatch {
  anthropic_model?: string;
  anthropic_base_url?: string;
  openai_model?: string;
  openai_base_url?: string;
  gemini_model?: string;
  gemini_base_url?: string;
  default_routing_mode?: string;
  governor_rpm?: number;
  governor_itpm?: number;
  governor_otpm?: number;
  daily_budget_usd?: number;
  monthly_budget_usd?: number;
  /** null clears the quota, a number sets it. Omit to leave unchanged. */
  per_instance_quota_pct?: number | null;
  max_concurrent_daemons?: number;
  boredom_threshold?: number;
  allow_tool_execution?: boolean;
  network_access?: NetworkAccess;
  network_allowlist?: string[];
  telegram_enabled?: boolean;
  /** null clears, a string sets, omit to leave unchanged. */
  telegram_default_instance?: string | null;
  telegram_authorized_chats?: string[];
  telegram_allow_stimulus_inject?: boolean;
}

export interface GovernorStatus {
  daily_spent_usd: number;
  daily_budget_usd: number;
  monthly_spent_usd: number;
  monthly_budget_usd: number;
  queue_depth: number;
  breaker_open: boolean;
  breaker_reopens_in_secs: number | null;
}

export interface LoopEventRow {
  loop_n: number;
  phase: string;
  model_used: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  outcome: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface CorpusChangedEvent {
  instance_id: string;
}

export const CORPUS_CHANGED = "corpus:changed";

export type StimulusKind = "discrete" | "standing" | "knowledge";

export const STIMULUS_KIND_LABELS: Record<StimulusKind, string> = {
  discrete: "Discrete reiz",
  standing: "Standing concern",
  knowledge: "Knowledge",
};

export interface StimulusEntry {
  name: string;
  category: string;
  modified_at: string;
  preview: string;
}

export interface OutboxReply {
  name: string;
  category: "inbox" | "processed";
  modified_at: string;
  content: string;
}

export interface OutboxThread {
  name: string;
  modified_at: string;
  content: string;
  replies: OutboxReply[];
  read: boolean;
}

export interface DriftMetrics {
  loop_n: number;
  tool_lag: number;
  last_tool_loop: number;
  unanimous_streak: number;
  elect_markers_missing: number;
  elect_window: number;
  network_access: NetworkAccess;
  network_allowlist_len: number;
}

export type NetworkAccess = "off" | "gated" | "open";

export interface AutoConfig {
  auto_mode_enabled: boolean;
  auto_reply_enabled: boolean;
  auto_reply_prompt: string | null;
  auto_stimulus_enabled: boolean;
  auto_stimulus_interval_minutes: number;
  auto_stimulus_prompt: string | null;
}

export const api = {
  createInstance: (
    name: string,
    routingMode?: RoutingMode,
    phaseRouting?: string,
  ) =>
    invoke<Instance>("create_instance", {
      name,
      routingMode,
      phaseRouting: phaseRouting ?? null,
    }),
  setInstanceRouting: (
    id: string,
    routingMode: RoutingMode,
    phaseRouting?: string,
  ) =>
    invoke<Instance>("set_instance_routing", {
      id,
      routingMode,
      phaseRouting: phaseRouting ?? null,
    }),
  listInstances: () => invoke<Instance[]>("list_instances"),
  getInstance: (id: string) => invoke<Instance>("get_instance", { id }),
  deleteInstance: (id: string) => invoke<void>("delete_instance", { id }),
  openInFinder: (id: string) => invoke<void>("open_instance_in_finder", { id }),
  runOneLoop: (id: string) => invoke<LoopResult>("run_one_loop", { id }),
  readEpisodicFile: (id: string, filename: string) =>
    invoke<string>("read_episodic_file", { id, filename }),
  listEpisodicFiles: (id: string) =>
    invoke<string[]>("list_episodic_files", { id }),

  // Settings + secrets
  setAnthropicKey: (key: string) => invoke<void>("set_anthropic_key", { key }),
  hasAnthropicKey: () => invoke<boolean>("has_anthropic_key"),
  clearAnthropicKey: () => invoke<void>("clear_anthropic_key"),
  setOpenaiKey: (key: string) => invoke<void>("set_openai_key", { key }),
  hasOpenaiKey: () => invoke<boolean>("has_openai_key"),
  clearOpenaiKey: () => invoke<void>("clear_openai_key"),
  setGeminiKey: (key: string) => invoke<void>("set_gemini_key", { key }),
  hasGeminiKey: () => invoke<boolean>("has_gemini_key"),
  clearGeminiKey: () => invoke<void>("clear_gemini_key"),
  setTelegramToken: (token: string) =>
    invoke<void>("set_telegram_token", { token }),
  hasTelegramToken: () => invoke<boolean>("has_telegram_token"),
  clearTelegramToken: () => invoke<void>("clear_telegram_token"),
  getSettings: () => invoke<Settings>("get_settings"),
  updateSettings: (patch: SettingsPatch) =>
    invoke<Settings>("update_settings", { patch }),
  getGovernorStatus: () => invoke<GovernorStatus>("get_governor_status"),

  // Daemon
  startDaemon: (id: string) => invoke<void>("start_daemon", { id }),
  stopDaemon: (id: string) => invoke<void>("stop_daemon", { id }),
  pauseAllDaemons: () => invoke<number>("pause_all_daemons"),
  daemonStatus: (id: string) => invoke<boolean>("daemon_status", { id }),
  listRunningDaemons: () => invoke<string[]>("list_running_daemons"),

  // Auto-Modus (operator-agent)
  getAutoConfig: (id: string) => invoke<AutoConfig>("get_auto_config", { id }),
  setAutoConfig: (id: string, config: AutoConfig) =>
    invoke<AutoConfig>("set_auto_config", { id, config }),
  autoModeStatus: (id: string) => invoke<boolean>("auto_mode_status", { id }),

  // Viewer
  openInstanceViewer: (id: string) =>
    invoke<void>("open_instance_viewer", { id }),
  closeInstanceViewer: () => invoke<void>("close_instance_viewer"),
  readStateMd: (id: string) => invoke<string>("read_state_md", { id }),
  readSuperinstance: (id: string) =>
    invoke<string>("read_superinstance", { id }),
  loopEventsForInstance: (id: string) =>
    invoke<LoopEventRow[]>("loop_events_for_instance", { id }),

  // Stimuli
  injectStimulus: (
    id: string,
    kind: StimulusKind,
    title: string,
    body: string,
    replyTo?: string,
  ) =>
    invoke<string>("inject_stimulus", {
      id,
      kind,
      title,
      body,
      replyTo: replyTo ?? null,
    }),
  listInbox: (id: string) => invoke<StimulusEntry[]>("list_inbox", { id }),
  listStanding: (id: string) =>
    invoke<StimulusEntry[]>("list_standing", { id }),
  listProcessed: (id: string) =>
    invoke<StimulusEntry[]>("list_processed", { id }),
  listOutbox: (id: string) => invoke<StimulusEntry[]>("list_outbox", { id }),
  listOutboxThreads: (id: string) =>
    invoke<OutboxThread[]>("list_outbox_threads", { id }),
  markOutboxRead: (id: string, name: string) =>
    invoke<void>("mark_outbox_read", { id, name }),
  markOutboxUnread: (id: string, name: string) =>
    invoke<void>("mark_outbox_unread", { id, name }),
  readStimulus: (id: string, category: string, name: string) =>
    invoke<string>("read_stimulus", { id, category, name }),

  // Drift diagnostics
  getDriftMetrics: (id: string) =>
    invoke<DriftMetrics>("get_drift_metrics", { id }),

  // Composer
  refineStimulus: (
    id: string,
    kind: StimulusKind,
    rawText: string,
  ) =>
    invoke<{ refined: string; notes: string[] }>("refine_stimulus", {
      id,
      kind,
      rawText,
    }),

  // Chat over telemetry
  chatAboutInstance: (
    id: string,
    history: ChatMessage[],
    message: string,
  ) =>
    invoke<{ reply: string; tools_used: string[] }>("chat_about_instance", {
      id,
      history,
      message,
    }),

  // Tools inventory + Network log (Phase 13)
  listTools: (id: string) => invoke<ToolFile[]>("list_tools", { id }),
  toolUsageStats: (id: string) =>
    invoke<ToolUsage[]>("tool_usage_stats", { id }),
  networkHistory: (id: string) =>
    invoke<NetworkHistory>("network_history", { id }),
  getInvariantsSnapshot: (id: string) =>
    invoke<InvariantsSnapshot>("get_invariants_snapshot", { id }),
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolFile {
  name: string;
  rel_path: string;
  size: number;
  modified_at: string;
  shebang: string | null;
  content: string;
  content_truncated: boolean;
}

export interface ToolUsage {
  tool: string;
  runs: number;
  successes: number;
  failures: number;
  last_loop: number | null;
  last_exit: number | null;
}

export interface ToolRunRow {
  tool: string;
  exit_code: number | null;
  output_excerpt: string;
  failed: boolean;
}

export interface ExpandReport {
  loop_n: number;
  network_policy: string;
  tool_runs: ToolRunRow[];
}

export interface NetworkHistory {
  current_policy: NetworkAccess;
  current_allowlist: string[];
  entries: ExpandReport[];
  window: number;
  note: string;
}

export interface InvariantCheck {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

export interface InvariantReport {
  checks: InvariantCheck[];
  warnings: string[];
}

export interface InvariantsSnapshot {
  loop_n: number;
  report: InvariantReport;
  all_passed: boolean;
}

export const DAEMON_EVENTS = {
  started: "daemon:started",
  stopped: "daemon:stopped",
  capBlocked: "daemon:cap_blocked",
} as const;

export interface DaemonStartedEvent {
  instance_id: string;
}

export interface DaemonStoppedEvent {
  instance_id: string;
  reason: "manual" | "boredom" | "error" | "pause_all";
}

export interface CapBlockedEvent {
  instance_id: string;
  cap: number;
}

export const LOOP_EVENTS = {
  phaseStarted: "loop:phase_started",
  phaseCompleted: "loop:phase_completed",
  completed: "loop:completed",
  failed: "loop:failed",
} as const;
