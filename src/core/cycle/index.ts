// The 6-phase metabolic loop. Events go through state.events.emit; secrets
// through state.secrets; the Governor lives in AppState (shared across loops so
// breaker/buckets/queue persist).
import * as fs from "node:fs";
import * as path from "node:path";
import type { AppState } from "../../state.ts";
import type { Instance } from "../instance.ts";
import { setStatusPhaseCounter } from "../instance.ts";
import { InstancePaths, writeAtomic } from "../../persistence/fs.ts";
import * as pgit from "../../persistence/git.ts";
import { loadSettings } from "../../persistence/settings.ts";
import { Router, type RouterConfig, type PromptParts } from "../../inference/router.ts";
import { type Phase, PHASES, type ChatResponse } from "../../inference/index.ts";
import { buildPrompt, inboxIsEmpty } from "../../inference/prompt.ts";
import { normalizeLang, type Lang } from "../../templates.ts";
import { AppError } from "../../error.ts";
import type { CancellationToken } from "../../util/cancel.ts";
import { type NetworkAccess } from "./sandbox.ts";
import { couplingPolicy } from "./coupling.ts";
import { processExpand } from "./expandIo.ts";
import { writePhaseFile, phaseFilePath } from "./episodic.ts";
import * as stateMd from "./stateMd.ts";
import {
  verifyInvariants,
  toMarkdown,
  allPassed,
  failureSummary,
  type InvariantReport,
} from "./invariants.ts";
import { substanceMetrics, meetsThreshold, type SubstanceMetrics } from "./substance.ts";

// #1 self-correcting phase retry: how many times a phase is re-called with
// corrective feedback after a mechanical/format failure before the loop fails.
const MAX_PHASE_RETRIES = 2;

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
  inbox_was_empty: boolean;
}

export async function runOneCycle(
  instance: Instance,
  state: AppState,
  cancel?: CancellationToken,
): Promise<LoopResult> {
  const start = Date.now();
  const paths = new InstancePaths(instance.path);

  const settings = loadSettings(state.db);
  const governor = state.governor;

  const router = Router.build({
    routingMode: instance.routing_mode,
    phaseRoutingJson: instance.phase_routing,
    anthropicBaseUrl: settings.anthropic_base_url,
    anthropicModel: settings.anthropic_model,
    anthropicKey: state.secrets.get("anthropic-api-key"),
    openaiBaseUrl: settings.openai_base_url,
    openaiModel: settings.openai_model,
    openaiKey: state.secrets.get("openai-api-key"),
    geminiBaseUrl: settings.gemini_base_url,
    geminiModel: settings.gemini_model,
    geminiKey: state.secrets.get("gemini-api-key"),
  } satisfies RouterConfig);
  await router.preflight();

  const loopN = stateMd.readCounter(paths.state());
  const inboxWasEmpty = inboxIsEmpty(paths);
  const anchor = pgit.headOid(paths.root);
  // Network policy + tool execution come from this instance's coupling level,
  // not a global toggle.
  const { networkPolicy, allowToolExecution } = couplingPolicy(instance.coupling_level);

  try {
    const phases = await runPhases(
      instance,
      paths,
      router,
      state,
      loopN,
      cancel,
      allowToolExecution,
      networkPolicy,
      settings.network_allowlist,
    );

    integrateClose(paths, loopN);

    const res: LoopResult = {
      instance_id: instance.id,
      loop_n: loopN,
      phases,
      duration_ms: Date.now() - start,
      final_counter: loopN + 1,
      inbox_was_empty: inboxWasEmpty,
    };
    state.events.emit("loop:completed", res);
    return res;
  } catch (e) {
    const err = e instanceof AppError ? e : new AppError("internal", String((e as Error)?.message ?? e));
    try {
      pgit.resetHard(paths.root, anchor);
      pgit.cleanUntracked(paths.root);
    } catch {
      /* best-effort rollback */
    }
    if (!err.isCancellation) {
      state.events.emit("loop:failed", {
        instance_id: instance.id,
        loop_n: loopN,
        error: err.toDisplay(),
      });
    }
    throw err;
  }
}

async function runPhases(
  instance: Instance,
  paths: InstancePaths,
  router: Router,
  state: AppState,
  loopN: number,
  cancel: CancellationToken | undefined,
  allowToolExecution: boolean,
  networkPolicy: NetworkAccess,
  networkAllowlist: string[],
): Promise<PhaseOutcome[]> {
  const outcomes: PhaseOutcome[] = [];

  for (const phase of PHASES) {
    if (cancel?.isCancelled) throw new AppError("cancelled", "cancelled");

    state.events.emit("loop:phase_started", {
      instance_id: instance.id,
      loop_n: loopN,
      phase,
      episodic_path: null,
    });
    // Keep instances.current_phase live so a view opened mid-loop can show the
    // current phase immediately (the phase_started event is missed on mount).
    try {
      setStatusPhaseCounter(state.db, instance.id, "running", phase, loopN);
    } catch {
      /* status mirror is best-effort */
    }

    const startedAt = new Date().toISOString();
    let outcome: PhaseOutcome | null = null;
    let outcomeLabel = "ok";
    let tokensIn: number | null = null;
    let tokensOut: number | null = null;
    let thrown: unknown = null;

    try {
      outcome = await runSinglePhase(
        paths,
        router,
        state,
        instance.id,
        phase,
        loopN,
        allowToolExecution,
        networkPolicy,
        networkAllowlist,
        normalizeLang(instance.language),
      );
      tokensIn = outcome.input_tokens;
      tokensOut = outcome.output_tokens;
    } catch (e) {
      thrown = e;
      const msg = e instanceof AppError ? e.toDisplay() : String((e as Error)?.message ?? e);
      outcomeLabel = `failed: ${msg}`;
    }
    const finishedAt = new Date().toISOString();

    try {
      recordPhaseEvent(
        state,
        instance.id,
        loopN,
        phase,
        startedAt,
        finishedAt,
        router.modelFor(phase),
        tokensIn,
        tokensOut,
        outcomeLabel,
      );
    } catch {
      /* event recording is best-effort */
    }

    if (thrown) throw thrown;

    state.events.emit("loop:phase_completed", {
      instance_id: instance.id,
      loop_n: loopN,
      phase,
      episodic_path: outcome!.episodic_path,
    });
    outcomes.push(outcome!);
  }

  return outcomes;
}

async function runSinglePhase(
  paths: InstancePaths,
  router: Router,
  state: AppState,
  instanceId: string,
  phase: Phase,
  loopN: number,
  allowToolExecution: boolean,
  networkPolicy: NetworkAccess,
  networkAllowlist: string[],
  lang: Lang,
): Promise<PhaseOutcome> {
  const base: PromptParts = buildPrompt(paths, phase, loopN, lang);

  // #1 Self-correcting retry. A phase can fail two ways: a *mechanical/format*
  // failure the model can fix by re-emitting (too-thin SC-001 output, or a
  // Review not starting with PASS/FAIL), or an *integrity* failure that must
  // roll back (Review FAIL verdict, SP-I invariants, missing prior files). We
  // re-call the phase up to MAX_PHASE_RETRIES times for the former, appending
  // the concrete reason; the latter throw straight through to rollback.
  let correction = "";
  for (let attempt = 0; ; attempt++) {
    const parts: PromptParts =
      correction === "" ? base : { ...base, dynamicUser: base.dynamicUser + correction };
    const response: ChatResponse = await router.call(phase, parts, instanceId, state.governor, state.db);

    const rawBody = phaseBody(response);
    const body =
      phase === "expand"
        ? await processExpand(rawBody, allowToolExecution, networkPolicy, networkAllowlist, paths.root)
        : rawBody;

    // SC-001 substance check (retryable). For Expand, measure the model's raw
    // output, not the code-composed (legitimately compact) episodic body.
    const sc001Input = phase === "expand" ? rawBody : body;
    const m = substanceMetrics(sc001Input);
    if (!meetsThreshold(m, 10)) {
      if (attempt < MAX_PHASE_RETRIES) {
        correction = substanceCorrection(phase, m);
        continue;
      }
      throw new AppError(
        "invalid_input",
        `phase ${phase} produced only ${m.lines} substantive lines and ${m.chars} substantive ` +
          `characters (SC-001 requires 10 lines OR 600 characters) after ${MAX_PHASE_RETRIES + 1} attempts`,
      );
    }

    if (phase === "review") {
      const firstLine = response.content.trim().split("\n")[0]?.trim() ?? "";
      const decision = firstLine.toUpperCase();
      // Malformed verdict line is a format error → retryable.
      if (decision !== "PASS" && decision !== "FAIL") {
        if (attempt < MAX_PHASE_RETRIES) {
          correction =
            "\n\n## Correction — malformed review\nYour review MUST begin with a single line that " +
            "is exactly `PASS` or `FAIL` (uppercase, nothing else on that line), then a blank line, " +
            "then your per-check reasoning. Re-emit the whole review correctly.";
          continue;
        }
        throw new AppError(
          "invalid_input",
          `review phase first line was not PASS or FAIL after ${MAX_PHASE_RETRIES + 1} attempts: ` +
            JSON.stringify(firstLine),
        );
      }
      // A deliberate FAIL verdict is an integrity decision → roll back, never retry.
      if (decision === "FAIL") {
        throw new AppError(
          "invalid_input",
          `review phase returned FAIL — rolling back. Reasoning:\n${response.content.trim()}`,
        );
      }

      // PASS — the remaining checks are integrity gates, not retryable.
      verifyAllPriorPhaseFiles(paths, loopN);
      const report: InvariantReport = verifyInvariants(paths, loopN);
      if (networkPolicy === "open") {
        report.warnings.push(
          "Network policy: OPEN — sandbox firewall disabled, all tools have raw " +
            "network access. This is the explicit exploration mode; flip it back " +
            "in Settings once you are done.",
        );
      } else if (networkPolicy === "gated") {
        report.warnings.push(
          `Network policy: GATED — sandbox allows TCP 80/443 to ${networkAllowlist.length} ` +
            `allowlisted host(s).`,
        );
      }
      const reviewBody = body + toMarkdown(report);
      if (!allPassed(report)) {
        throw new AppError(
          "invalid_input",
          `SP-I invariant violation — rolling back:\n${failureSummary(report)}`,
        );
      }
      const episodicPath = writePhaseFile(paths, loopN, phase, reviewBody);
      return {
        phase,
        episodic_path: episodicPath,
        input_tokens: response.inputTokens,
        output_tokens: response.outputTokens,
        latency_ms: response.latencyMs,
      };
    }

    const episodicPath = writePhaseFile(paths, loopN, phase, body);
    return {
      phase,
      episodic_path: episodicPath,
      input_tokens: response.inputTokens,
      output_tokens: response.outputTokens,
      latency_ms: response.latencyMs,
    };
  }
}

/** Corrective feedback appended to a phase prompt after a too-thin SC-001 output. */
function substanceCorrection(phase: Phase, m: SubstanceMetrics): string {
  const extra =
    phase === "expand"
      ? " For Expand specifically: write a richer INTENT block and/or a real FILE_WRITE block with " +
        "actual file content — markers with no body beneath them are thin and count for little."
      : "";
  return (
    "\n\n## Correction — output too thin\n" +
    `Your previous ${phase} output had only ${m.lines} substantive lines and ${m.chars} characters. ` +
    "SC-001 requires at least 10 substantive lines OR 600 characters, or the whole loop is rejected " +
    "and rolled back. Re-do this phase now with real substance." +
    extra
  );
}

function recordPhaseEvent(
  state: AppState,
  instanceId: string,
  loopN: number,
  phase: Phase,
  startedAt: string,
  finishedAt: string,
  model: string,
  tokensIn: number | null,
  tokensOut: number | null,
  outcome: string,
): void {
  state.db
    .prepare(
      `INSERT INTO loop_events
         (instance_id, loop_n, phase, started_at, finished_at, model_used, tokens_in, tokens_out, outcome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(instanceId, loopN, phase, startedAt, finishedAt, model, tokensIn, tokensOut, outcome);
}

function integrateClose(paths: InstancePaths, loopN: number): void {
  const now = new Date().toISOString();
  const finalPath = path.join(paths.episodic(), `loop-${String(loopN).padStart(5, "0")}-final.md`);
  let finalBody = "";
  try {
    finalBody = fs.readFileSync(finalPath, "utf8");
  } catch {
    finalBody = "";
  }
  const { narrative, cleaned } = stateMd.splitIntegrateOutput(finalBody);

  if (narrative !== null) {
    stateMd.rebuildWithNarrative(paths.state(), loopN + 1, now, narrative);
    if (cleaned !== finalBody) writeAtomic(finalPath, cleaned);
  } else {
    stateMd.applyIntegrate(paths.state(), loopN + 1, now);
  }

  archiveProcessedStimuli(paths, now);

  pgit.commitAll(paths.root, `loop ${String(loopN).padStart(5, "0")}: integrate`);
}

function archiveProcessedStimuli(paths: InstancePaths, nowRfc: string): void {
  const inbox = paths.stimuliInbox();
  if (!fs.existsSync(inbox)) return;
  let entries: string[];
  try {
    entries = fs
      .readdirSync(inbox)
      .filter((n) => !n.startsWith("."))
      .filter((n) => {
        try {
          return fs.statSync(path.join(inbox, n)).isFile();
        } catch {
          return false;
        }
      });
  } catch {
    return;
  }
  if (entries.length === 0) return;

  const ym = nowRfc.slice(0, 7); // YYYY-MM
  const targetDir = path.join(paths.stimuliProcessed(), ym);
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch {
    // Archiving is best-effort housekeeping. If the target dir can't be created
    // (e.g. permissions), skip it rather than throwing — and rolling back — an
    // otherwise-committed loop.
    return;
  }

  for (const name of entries) {
    const from = path.join(inbox, name);
    const to = path.join(targetDir, name);
    try {
      fs.renameSync(from, to);
    } catch {
      // Cross-device rename (EXDEV) → copy+unlink. If the source vanished
      // between the readdir scan and here, there is nothing to archive — skip
      // it rather than throwing ENOENT and failing the whole integrate.
      try {
        const bytes = fs.readFileSync(from);
        fs.writeFileSync(to, bytes);
        fs.unlinkSync(from);
      } catch {
        /* source already gone or unreadable — nothing to archive */
      }
    }
  }
}

/** Strip an optional fenced-code wrapper the model might add around its answer. */
function phaseBody(response: ChatResponse): string {
  const trimmed = response.content.trim();
  if (trimmed.startsWith("```")) {
    const rest = trimmed.slice(3);
    const nl = rest.indexOf("\n");
    const afterFirstLine = nl >= 0 ? rest.slice(nl + 1) : rest;
    const trimmedEnd = afterFirstLine.replace(/\s+$/, "");
    if (trimmedEnd.endsWith("```")) {
      return trimmedEnd.slice(0, -3).trim();
    }
  }
  return trimmed;
}

function ensurePhaseSubstance(phase: Phase, body: string, minLines: number): void {
  const m = substanceMetrics(body);
  if (meetsThreshold(m, minLines)) return;
  throw new AppError(
    "invalid_input",
    `phase ${phase} produced only ${m.lines} substantive lines and ${m.chars} substantive characters ` +
      `(SC-001 requires ${minLines} lines OR ${minLines * 60} characters)`,
  );
}

function verifyAllPriorPhaseFiles(paths: InstancePaths, loopN: number): void {
  const prior: Phase[] = ["observe", "diverge", "elect", "expand"];
  for (const p of prior) {
    const f = phaseFilePath(paths, loopN, p);
    if (!fs.existsSync(f)) {
      throw new AppError("invalid_input", `review check: prior phase file missing: ${f}`);
    }
    if (p !== "expand") {
      const body = fs.readFileSync(f, "utf8");
      ensurePhaseSubstance(p, body, 10);
    }
  }
}
