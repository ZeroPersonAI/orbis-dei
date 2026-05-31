// Maps the 47 Tauri command names to handlers over AppState. The HTTP layer
// dispatches `POST /api/command/<name>` here; the WebSocket layer relays events.
// Args arrive as the same camelCase object the frontend's `invoke(name, args)`
// produced, so field access mirrors tauri-bindings.ts exactly.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import type { AppState } from "../state.ts";
import * as instance from "../core/instance.ts";
import { InstancePaths } from "../persistence/fs.ts";
import { loadSettings, applyPatch, type SettingsPatch } from "../persistence/settings.ts";
import { validateRoutingMode } from "../inference/provider.ts";
import { AnthropicClient } from "../inference/anthropic.ts";
import * as budget from "../inference/governor/budget.ts";
import type { GovernorSettings } from "../inference/governor/index.ts";
import { runOneCycle } from "../core/cycle/index.ts";
import { readCounter } from "../core/cycle/stateMd.ts";
import { computeUnanimousStreak } from "../core/cycle/electResult.ts";
import { walkRecentExpands } from "../core/cycle/expandLog.ts";
import { verifyInvariants, allPassed } from "../core/cycle/invariants.ts";
import { parseNetworkAccess } from "../core/cycle/sandbox.ts";
import * as stimulus from "../core/stimulus.ts";
import { chatAboutInstance, type ChatMessage } from "../core/chat.ts";
import { InstanceWatcher } from "../watch.ts";
import { invalidInput, missingConfig, notFound, internal } from "../error.ts";

const ELECT_WINDOW = 25;
const USAGE_WINDOW = 50;
const HISTORY_WINDOW = 50;
const CONTENT_MAX_BYTES = 16 * 1024;
const COMPOSER_MAX_INPUT = 100 * 1024;
const COMPOSER_MAX_NOTES = 5;

const pathsFor = (state: AppState, id: string) =>
  new InstancePaths(instance.pathOf(state.db, id));

const auto = (i: instance.Instance) => ({
  auto_mode_enabled: i.auto_mode_enabled,
  auto_reply_enabled: i.auto_reply_enabled,
  auto_reply_prompt: i.auto_reply_prompt,
  auto_stimulus_enabled: i.auto_stimulus_enabled,
  auto_stimulus_interval_minutes: i.auto_stimulus_interval_minutes,
  auto_stimulus_prompt: i.auto_stimulus_prompt,
});

const COMPOSER_SYSTEM = `You are a stimulus refinement helper. The operator types raw text that will be injected as a stimulus into a research organism's corpus. Your only job is to improve clarity.

Strict rules:
- Do not add facts the operator did not write.
- Do not make the text more persuasive, urgent, or 'better accepted'.
- Do not assign confidence, source weight, or reliability.
- Fix grammar, structure, ambiguity. Keep the operator's voice and language.
- If the text is already clear, return it nearly unchanged.

Output format — exactly two HTML-comment blocks, nothing else:

<!-- REFINED -->
<the refined text, verbatim, ready to be saved as the stimulus body>
<!-- END_REFINED -->
<!-- NOTES -->
- one short note per line on what changed (at most three; may be empty)
<!-- END_NOTES -->`;

function extractBetween(text: string, open: string, close: string): string | null {
  const o = text.indexOf(open);
  if (o < 0) return null;
  const after = text.slice(o + open.length);
  const c = after.indexOf(close);
  if (c < 0) return null;
  return after.slice(0, c);
}

export type CommandHandler = (args: any, state: AppState) => unknown | Promise<unknown>;

export function buildCommands(state: AppState): Record<string, CommandHandler> {
  const reconfigureGovernor = () => {
    const s = loadSettings(state.db);
    const g: GovernorSettings = {
      rpm: s.governor_rpm,
      itpm: s.governor_itpm,
      otpm: s.governor_otpm,
      dailyBudgetUsd: s.daily_budget_usd,
      monthlyBudgetUsd: s.monthly_budget_usd,
      perInstanceQuotaPct: s.per_instance_quota_pct,
    };
    void state.governor.reconfigure(g);
  };

  return {
    // ---- instance ----
    create_instance: (a) => {
      const inst = instance.bootstrap(a.name, a.routingMode ?? "", state.instancesDir);
      if (a.phaseRouting && String(a.phaseRouting).trim().length > 0) {
        inst.phase_routing = a.phaseRouting;
      }
      instance.insert(state.db, inst);
      if (inst.phase_routing) {
        instance.updateRouting(state.db, inst.id, inst.routing_mode, inst.phase_routing);
      }
      return inst;
    },
    set_instance_routing: (a) => {
      validateRoutingMode(a.routingMode);
      const phaseRouting =
        a.phaseRouting && String(a.phaseRouting).trim().length > 0 ? a.phaseRouting : null;
      instance.updateRouting(state.db, a.id, a.routingMode, phaseRouting);
      return instance.get(state.db, a.id);
    },
    list_instances: () => instance.listAll(state.db),
    get_instance: (a) => instance.get(state.db, a.id),
    delete_instance: async (a) => {
      // Stop any running daemon / auto-mode first so nothing writes after delete.
      await state.orchestrator.stop(a.id).catch(() => {});
      await state.autoMode.stop(a.id).catch(() => {});
      const p = instance.deleteRow(state.db, a.id);
      fs.rmSync(p, { recursive: true, force: true });
      return null;
    },

    // ---- system ----
    open_instance_in_finder: (a) => {
      const p = instance.pathOf(state.db, a.id);
      if (process.platform === "darwin") execFile("open", [p], () => {});
      else if (process.platform === "win32") execFile("explorer", [p], () => {});
      else execFile("xdg-open", [p], () => {});
      return null;
    },

    // ---- loop ----
    run_one_loop: async (a) => {
      const inst = instance.get(state.db, a.id);
      instance.setStatusPhaseCounter(state.db, a.id, "running", "observe", inst.loop_counter);
      try {
        const r = await runOneCycle(inst, state);
        instance.setStatusPhaseCounter(state.db, a.id, "idle", "integrate", r.final_counter);
        return r;
      } catch (e) {
        instance.setStatusPhaseCounter(state.db, a.id, "error", null, inst.loop_counter);
        throw e;
      }
    },
    read_episodic_file: (a) => {
      const fn = a.filename;
      if (fn.includes("..") || fn.includes("/") || fn.includes("\\")) {
        throw invalidInput("invalid filename");
      }
      const full = path.join(instance.pathOf(state.db, a.id), "corpus", "episodic", fn);
      try {
        return fs.readFileSync(full, "utf8");
      } catch (e: any) {
        throw notFound(`could not read episodic file ${full}: ${e?.message ?? e}`);
      }
    },
    list_episodic_files: (a) => {
      const dir = path.join(instance.pathOf(state.db, a.id), "corpus", "episodic");
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((n) => n.toLowerCase().endsWith(".md"))
        .sort();
    },

    // ---- secrets ----
    set_anthropic_key: (a) => (state.secrets.set("anthropic-api-key", a.key), null),
    has_anthropic_key: () => state.secrets.has("anthropic-api-key"),
    clear_anthropic_key: () => (state.secrets.clear("anthropic-api-key"), null),
    set_openai_key: (a) => (state.secrets.set("openai-api-key", a.key), null),
    has_openai_key: () => state.secrets.has("openai-api-key"),
    clear_openai_key: () => (state.secrets.clear("openai-api-key"), null),
    set_gemini_key: (a) => (state.secrets.set("gemini-api-key", a.key), null),
    has_gemini_key: () => state.secrets.has("gemini-api-key"),
    clear_gemini_key: () => (state.secrets.clear("gemini-api-key"), null),
    set_telegram_token: (a) => (state.secrets.set("telegram-bot-token", a.token), null),
    has_telegram_token: () => state.secrets.has("telegram-bot-token"),
    clear_telegram_token: () => (state.secrets.clear("telegram-bot-token"), null),

    // ---- settings ----
    get_settings: () => loadSettings(state.db),
    update_settings: (a) => {
      applyPatch(state.db, (a.patch ?? {}) as SettingsPatch);
      reconfigureGovernor();
      return loadSettings(state.db);
    },
    get_governor_status: async () => {
      const s = loadSettings(state.db);
      const [open, reopenSecs] = await state.governor.breakerStatus();
      return {
        daily_spent_usd: budget.todaySpentUsd(state.db),
        daily_budget_usd: s.daily_budget_usd,
        monthly_spent_usd: budget.monthSpentUsd(state.db),
        monthly_budget_usd: s.monthly_budget_usd,
        queue_depth: await state.governor.queueDepth(),
        breaker_open: open,
        breaker_reopens_in_secs: reopenSecs,
      };
    },

    // ---- auto-mode ----
    get_auto_config: (a) => auto(instance.get(state.db, a.id)),
    set_auto_config: async (a) => {
      const c = a.config;
      instance.updateAutoConfig(
        state.db,
        a.id,
        !!c.auto_mode_enabled,
        !!c.auto_reply_enabled,
        c.auto_reply_prompt ?? null,
        !!c.auto_stimulus_enabled,
        Number(c.auto_stimulus_interval_minutes ?? 15),
        c.auto_stimulus_prompt ?? null,
      );
      if (c.auto_mode_enabled) await state.autoMode.start(a.id);
      else await state.autoMode.stop(a.id);
      return auto(instance.get(state.db, a.id));
    },
    auto_mode_status: (a) => state.autoMode.isRunning(a.id),

    // ---- daemon ----
    start_daemon: async (a) => (await state.orchestrator.start(a.id), null),
    stop_daemon: async (a) => (await state.orchestrator.stop(a.id), null),
    pause_all_daemons: async () => await state.orchestrator.pauseAll(),
    daemon_status: (a) => state.orchestrator.isRunning(a.id),
    list_running_daemons: () => state.orchestrator.runningIds(),

    // ---- viewer ----
    open_instance_viewer: (a) => {
      const corpus = path.join(instance.pathOf(state.db, a.id), "corpus");
      state.viewerWatcher?.close();
      state.viewerWatcher = InstanceWatcher.start(a.id, corpus, state.events);
      return null;
    },
    close_instance_viewer: () => {
      state.viewerWatcher?.close();
      state.viewerWatcher = null;
      return null;
    },
    read_state_md: (a) => {
      try {
        return fs.readFileSync(path.join(instance.pathOf(state.db, a.id), "corpus", "state.md"), "utf8");
      } catch (e: any) {
        throw notFound(`state.md: ${e?.message ?? e}`);
      }
    },
    read_superinstance: (a) => {
      try {
        return fs.readFileSync(
          path.join(instance.pathOf(state.db, a.id), "superinstance", "current.md"),
          "utf8",
        );
      } catch (e: any) {
        throw notFound(`superinstance/current.md: ${e?.message ?? e}`);
      }
    },
    loop_events_for_instance: (a) =>
      state.db
        .prepare(
          `SELECT loop_n, phase, model_used, tokens_in, tokens_out, outcome, started_at, finished_at
           FROM loop_events WHERE instance_id = ? ORDER BY id`,
        )
        .all(a.id),

    // ---- stimuli ----
    inject_stimulus: (a) => stimulus.injectStimulus(state, a.id, a.kind, a.title, a.body, a.replyTo ?? null),
    list_inbox: (a) => stimulus.listInbox(state, a.id),
    list_standing: (a) => stimulus.listStanding(state, a.id),
    list_outbox: (a) => stimulus.listOutbox(state, a.id),
    list_processed: (a) => stimulus.listProcessed(state, a.id),
    list_outbox_threads: (a) => stimulus.listOutboxThreads(state, a.id),
    mark_outbox_read: (a) => (stimulus.markOutboxRead(state, a.id, a.name), null),
    mark_outbox_unread: (a) => (stimulus.markOutboxUnread(state, a.id, a.name), null),
    read_stimulus: (a) => stimulus.readStimulus(state, a.id, a.category, a.name),

    // ---- drift ----
    get_drift_metrics: (a) => {
      const paths = pathsFor(state, a.id);
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
      const streak = computeUnanimousStreak(paths.episodic(), ELECT_WINDOW);
      const s = loadSettings(state.db);
      return {
        loop_n: loopN,
        tool_lag: Math.max(0, loopN - lastToolLoop),
        last_tool_loop: lastToolLoop,
        unanimous_streak: streak.unanimousStreak,
        elect_markers_missing: streak.markersMissingInWindow,
        elect_window: streak.window,
        network_access: s.network_access,
        network_allowlist_len: s.network_allowlist.length,
      };
    },

    // ---- composer ----
    refine_stimulus: async (a) => {
      const raw = String(a.rawText ?? "").trim();
      if (raw.length === 0) throw invalidInput("nothing to refine");
      if (Buffer.byteLength(raw) > COMPOSER_MAX_INPUT) {
        throw invalidInput(`text exceeds the ${COMPOSER_MAX_INPUT / 1024} KB refinement cap`);
      }
      const s = loadSettings(state.db);
      const key = state.secrets.get("anthropic-api-key");
      if (!key) {
        throw missingConfig(
          "Anthropic API key not set. Open Settings to add one — refinement only works with a remote model. You can still inject the original text without refining.",
        );
      }
      const client = new AnthropicClient(s.anthropic_base_url, key);
      const user = `Raw stimulus text to refine (${Buffer.byteLength(raw)} bytes):\n\n\`\`\`\n${raw}\n\`\`\``;
      const reply = await client.chat(s.anthropic_model, COMPOSER_SYSTEM, "", user);
      const refined = extractBetween(reply.content, "<!-- REFINED -->", "<!-- END_REFINED -->");
      if (refined === null) {
        throw internal("refiner returned no REFINED block — model did not follow the output format");
      }
      const notesBlock = extractBetween(reply.content, "<!-- NOTES -->", "<!-- END_NOTES -->") ?? "";
      const notes = notesBlock
        .split("\n")
        .map((l) => l.trim().replace(/^-/, "").trim())
        .filter((l) => l.length > 0)
        .slice(0, COMPOSER_MAX_NOTES);
      return { refined: refined.trim(), notes };
    },

    // ---- chat ----
    chat_about_instance: (a) =>
      chatAboutInstance(state, a.id, (a.history ?? []) as ChatMessage[], a.message),

    // ---- tools inventory ----
    list_tools: (a) => {
      const paths = pathsFor(state, a.id);
      const out: any[] = [];
      const collect = (dir: string, relPrefix: string) => {
        let names: string[];
        try {
          names = fs.readdirSync(dir);
        } catch {
          return;
        }
        for (const name of names) {
          if (name.startsWith(".")) continue;
          const full = path.join(dir, name);
          let st: fs.Stats;
          try {
            st = fs.statSync(full);
          } catch {
            continue;
          }
          if (!st.isFile()) continue;
          let raw = "";
          try {
            raw = fs.readFileSync(full, "utf8");
          } catch {
            raw = "";
          }
          const truncated = Buffer.byteLength(raw) > CONTENT_MAX_BYTES;
          const content = truncated ? [...raw].slice(0, CONTENT_MAX_BYTES).join("") : raw;
          const firstLine = raw.split("\n")[0] ?? "";
          out.push({
            name,
            rel_path: `${relPrefix}/${name}`,
            size: st.size,
            modified_at: st.mtime.toISOString(),
            shebang: firstLine.startsWith("#!") ? firstLine : null,
            content,
            content_truncated: truncated,
          });
        }
      };
      collect(paths.toolsNative(), "tools/native");
      collect(paths.toolsExternal(), "tools/external");
      out.sort((x, y) => y.modified_at.localeCompare(x.modified_at));
      return out;
    },
    tool_usage_stats: (a) => {
      const paths = pathsFor(state, a.id);
      const reports = walkRecentExpands(paths.episodic(), USAGE_WINDOW);
      const stats = new Map<string, any>();
      for (const r of reports) {
        for (const run of r.toolRuns) {
          let e = stats.get(run.tool);
          if (!e) {
            e = { tool: run.tool, runs: 0, successes: 0, failures: 0, last_loop: null, last_exit: null };
            stats.set(run.tool, e);
          }
          e.runs += 1;
          if (run.failed) e.failures += 1;
          else e.successes += 1;
          if (e.last_loop === null) {
            e.last_loop = r.loopN;
            e.last_exit = run.exitCode;
          }
        }
      }
      return [...stats.values()].sort((x, y) => y.runs - x.runs);
    },

    // ---- network log ----
    network_history: (a) => {
      const paths = pathsFor(state, a.id);
      const s = loadSettings(state.db);
      const reports = walkRecentExpands(paths.episodic(), HISTORY_WINDOW)
        .filter((r) => r.networkPolicy !== "off" || r.toolRuns.length > 0)
        .map((r) => ({
          loop_n: r.loopN,
          network_policy: r.networkPolicy,
          tool_runs: r.toolRuns.map((t) => ({
            tool: t.tool,
            exit_code: t.exitCode,
            output_excerpt: t.outputExcerpt,
            failed: t.failed,
          })),
        }));
      return {
        current_policy: s.network_access,
        current_allowlist: s.network_allowlist,
        entries: reports,
        window: HISTORY_WINDOW,
        note:
          "Per-URL accounting requires an outbound proxy that this app does not run. The output " +
          "excerpts below are the tools' own stdout/stderr — any URLs they hit usually show up " +
          "there. For full output use the Episodic tab.",
      };
    },

    // ---- invariants snapshot ----
    get_invariants_snapshot: (a) => {
      const paths = pathsFor(state, a.id);
      const s = loadSettings(state.db);
      const loopN = (() => {
        try {
          return readCounter(paths.state());
        } catch {
          return 1;
        }
      })();
      const report = verifyInvariants(paths, loopN);
      const policy = parseNetworkAccess(s.network_access);
      if (policy === "open") {
        report.warnings.push(
          "Network policy: OPEN — sandbox firewall disabled, all tools have raw network access.",
        );
      } else if (policy === "gated") {
        report.warnings.push(
          `Network policy: GATED — sandbox allows TCP 80/443 to ${s.network_allowlist.length} allowlisted host(s).`,
        );
      }
      return { loop_n: loopN, report, all_passed: allPassed(report) };
    },
  };
}
