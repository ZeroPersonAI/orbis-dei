import { useCallback, useEffect, useState } from "react";
import {
  api,
  ROUTING_MODE_LABELS,
  type Instance,
} from "../lib/tauri-bindings";
import { useLoopState } from "../lib/loop-events";
import { useDaemonState } from "../lib/daemon-events";
import { useCorpusWatch } from "../lib/corpus-events";
import { PhaseIndicator } from "../components/PhaseIndicator";
import { StatePanel } from "../components/StatePanel";
import { EpisodicTimeline } from "../components/EpisodicTimeline";
import { SuperinstancePanel } from "../components/SuperinstancePanel";
import { StimulusInbox } from "../components/StimulusInbox";
import { DriftWarnings } from "../components/DriftWarnings";
import { ObserveChat } from "../components/ObserveChat";
import { ToolsInventory } from "../components/ToolsInventory";
import { NetworkLog } from "../components/NetworkLog";
import { Dashboard } from "../components/Dashboard";
import { Messages } from "../components/Messages";
import { AutoModeTab } from "../components/AutoModeTab";
import { useT } from "../lib/i18n";

interface Props {
  instanceId: string;
  onBack: () => void;
}

type Tab =
  | "dashboard"
  | "messages"
  | "state"
  | "episodic"
  | "stimuli"
  | "observe"
  | "tools"
  | "network"
  | "superinstance"
  | "auto_mode";

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-neutral-600",
  running: "bg-emerald-500 animate-pulse",
  paused: "bg-amber-500",
  error: "bg-red-500",
  boredom_pause: "bg-sky-500",
};

export function InstanceView({ instanceId, onBack }: Props) {
  const { t } = useT();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const corpusTick = useCorpusWatch(instanceId);
  const loopState = useLoopState(instanceId);
  const daemon = useDaemonState(instanceId, corpusTick);

  // Single refresh signal for every tab. Bumps on corpus file changes AND on
  // daemon/loop transitions — pause/play don't touch corpus files, so without
  // this the Dashboard's status badge (read from instance.status) would not
  // re-fetch on pause.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    setRefreshTick((t) => t + 1);
  }, [corpusTick, daemon.running, loopState.kind]);

  // Start/stop the backend corpus watcher with the viewer's lifetime.
  useEffect(() => {
    api.openInstanceViewer(instanceId).catch((e) => setError(String(e)));
    return () => {
      api.closeInstanceViewer().catch(() => {});
    };
  }, [instanceId]);

  const refreshInstance = useCallback(async () => {
    try {
      setInstance(await api.getInstance(instanceId));
    } catch (e) {
      setError(String(e));
    }
  }, [instanceId]);

  useEffect(() => {
    refreshInstance();
  }, [refreshInstance, corpusTick, loopState.kind, daemon.running]);

  const isRunning = daemon.running || loopState.kind === "running";
  // Prefer the live loop event; on mount (event missed) fall back to the
  // instance's persisted current_phase while the daemon is running.
  const activePhase =
    loopState.kind === "running"
      ? loopState.phase
      : daemon.running
        ? (instance?.current_phase ?? null)
        : null;

  async function handlePlay() {
    setBusy(true);
    setError(null);
    try {
      await api.startDaemon(instanceId);
      await refreshInstance();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePause() {
    setBusy(true);
    setError(null);
    try {
      await api.stopDaemon(instanceId);
      await refreshInstance();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRunOnce() {
    setBusy(true);
    setError(null);
    try {
      await api.runOneLoop(instanceId);
      await refreshInstance();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const dotClass =
    STATUS_COLORS[isRunning ? "running" : instance?.status ?? "idle"] ??
    "bg-neutral-600";

  return (
    <div className="h-full w-full flex flex-col bg-neutral-950 text-neutral-100">
      <header className="px-6 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-neutral-400 hover:text-neutral-100 text-sm"
          >
            ← {t("Back")}
          </button>
          <div className={`w-2 h-2 rounded-full ${dotClass}`} />
          <h1 className="text-lg font-light tracking-tight">
            {instance?.name ?? instanceId.slice(0, 8)}
          </h1>
          <span className="text-xs text-neutral-500 font-mono">
            {t("loop")} {instance?.loop_counter ?? "—"}
          </span>
          <span className="text-xs text-neutral-500">
            {instance
              ? (ROUTING_MODE_LABELS[instance.routing_mode] ??
                instance.routing_mode)
              : ""}
          </span>

          <div className="ml-auto flex gap-2">
            {daemon.running ? (
              <button
                onClick={handlePause}
                disabled={busy}
                className="px-2.5 py-1 text-[11px] bg-amber-200 text-amber-950 rounded hover:bg-amber-100 disabled:opacity-50"
              >
                ⏸ {t("Pause")}
              </button>
            ) : (
              <>
                <button
                  onClick={handlePlay}
                  disabled={busy}
                  className="px-2.5 py-1 text-[11px] bg-emerald-300 text-emerald-950 rounded hover:bg-emerald-200 disabled:opacity-50"
                >
                  ▶ {t("Play")}
                </button>
                <button
                  onClick={handleRunOnce}
                  disabled={busy || loopState.kind === "running"}
                  className="px-2.5 py-1 text-[11px] bg-neutral-100 text-neutral-900 rounded hover:bg-white disabled:opacity-50"
                >
                  {t("Run Once")}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-2.5">
          <PhaseIndicator activePhase={activePhase} />
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-3 px-3 py-2 bg-red-950 border border-red-900 rounded text-sm text-red-200 flex items-start gap-3">
          <span className="flex-1 break-words">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-100 underline"
          >
            {t("dismiss")}
          </button>
        </div>
      )}

      <DriftWarnings instanceId={instanceId} refreshTick={refreshTick} />

      {instance?.status === "boredom_pause" && (
        <div className="mx-6 mt-3 px-3 py-2 bg-sky-950 border border-sky-900 rounded text-sm text-sky-200">
          {t("{n} loops without a stimulus — the system is requesting stimulus.", {
            n: instance.loops_since_last_stimulus,
          })}{" "}
          <button
            onClick={() => setTab("stimuli")}
            className="underline hover:text-sky-100"
          >
            {t("Inject a stimulus")}
          </button>{" "}
          {t("and press ▶ Play to continue.")}
        </div>
      )}

      <nav className="px-6 pt-3 flex gap-1">
        {(
          [
            ["dashboard", "Dashboard"],
            ["messages", "Messages"],
            ["state", "State"],
            ["episodic", "Episodic"],
            ["stimuli", "Stimuli"],
            ["observe", "Observe"],
            ["tools", "Tools"],
            ["network", "Network"],
            ["superinstance", "Superinstance"],
            ["auto_mode", "Auto Mode"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs rounded-t ${
              tab === key
                ? "bg-neutral-900 text-neutral-100 border-b-2 border-emerald-500"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t(label)}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto border-t border-neutral-800 p-6">
        {tab === "dashboard" && (
          <Dashboard instanceId={instanceId} refreshTick={refreshTick} />
        )}
        {tab === "messages" && (
          <Messages
            instanceId={instanceId}
            refreshTick={refreshTick}
            onReplied={refreshInstance}
          />
        )}
        {tab === "state" && (
          <StatePanel instanceId={instanceId} refreshTick={refreshTick} />
        )}
        {tab === "episodic" && (
          <EpisodicTimeline instanceId={instanceId} refreshTick={refreshTick} />
        )}
        {tab === "stimuli" && (
          <StimulusInbox
            instanceId={instanceId}
            refreshTick={refreshTick}
            onStimulusInjected={refreshInstance}
          />
        )}
        {tab === "observe" && <ObserveChat instanceId={instanceId} />}
        {tab === "tools" && (
          <ToolsInventory instanceId={instanceId} refreshTick={refreshTick} />
        )}
        {tab === "network" && (
          <NetworkLog instanceId={instanceId} refreshTick={refreshTick} />
        )}
        {tab === "superinstance" && (
          <SuperinstancePanel
            instanceId={instanceId}
            refreshTick={refreshTick}
          />
        )}
        {tab === "auto_mode" && <AutoModeTab instanceId={instanceId} />}
      </main>
    </div>
  );
}
