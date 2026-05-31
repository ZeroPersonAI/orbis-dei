import { useState } from "react";
import {
  api,
  ROUTING_MODE_LABELS,
  type Instance,
} from "../lib/tauri-bindings";
import { useLoopState } from "../lib/loop-events";
import { useDaemonState } from "../lib/daemon-events";

interface Props {
  instance: Instance;
  onOpenFinder: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  onOpen: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-neutral-600",
  running: "bg-emerald-500 animate-pulse",
  paused: "bg-amber-500",
  error: "bg-red-500",
  boredom_pause: "bg-sky-500",
  budget_pause: "bg-orange-500",
  quota_pause: "bg-orange-500",
};

const STOP_REASON_LABEL: Record<string, string> = {
  manual: "stopped manually",
  pause_all: "paused via Pause All",
  boredom: "auto-paused (boredom — 50 loops without stimulus)",
  error: "auto-paused (error)",
};

export function InstanceCard({
  instance,
  onOpenFinder,
  onDelete,
  onRefresh,
  onOpen,
}: Props) {
  const loopState = useLoopState(instance.id);
  const daemon = useDaemonState(instance.id, instance.loop_counter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dotClass = STATUS_COLORS[daemon.running ? "running" : instance.status] ?? "bg-neutral-600";

  async function handlePlay() {
    setError(null);
    setBusy(true);
    try {
      await api.startDaemon(instance.id);
      await onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePause() {
    setError(null);
    setBusy(true);
    try {
      await api.stopDaemon(instance.id);
      await onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRunOnce() {
    setError(null);
    setBusy(true);
    try {
      await api.runOneLoop(instance.id);
      await onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const showAutoPauseNote =
    !daemon.running && daemon.lastStopReason && daemon.lastStopReason !== "manual";

  return (
    <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 hover:border-neutral-700 transition">
      <div
        onClick={onOpen}
        className="cursor-pointer"
        title="Open instance viewer"
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="font-medium truncate">{instance.name}</h3>
            <p className="text-[10px] text-neutral-500 mt-1 font-mono">
              {instance.id.slice(0, 8)}
            </p>
          </div>
          <div
            className={`w-2 h-2 rounded-full ${dotClass} mt-1.5 shrink-0`}
            title={daemon.running ? "daemon running" : instance.status}
          />
        </div>

        <dl className="mt-3 text-xs space-y-1">
        <div className="flex justify-between">
          <dt className="text-neutral-500">Loop</dt>
          <dd className="text-neutral-300 font-mono">{instance.loop_counter}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Phase</dt>
          <dd className="text-neutral-300">
            {loopState.kind === "running"
              ? loopState.phase
              : instance.current_phase ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Routing</dt>
          <dd className="text-neutral-300 text-[11px]">
            {ROUTING_MODE_LABELS[instance.routing_mode] ?? instance.routing_mode}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Since stim.</dt>
          <dd className="text-neutral-300 font-mono">
            {instance.loops_since_last_stimulus}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Born</dt>
          <dd className="text-neutral-300">
            {new Date(instance.created_at).toLocaleDateString()}
          </dd>
        </div>
        </dl>
      </div>

      {showAutoPauseNote && (
        <div className="mt-3 p-2 bg-neutral-950 border border-amber-900 rounded text-[11px] text-amber-200">
          {STOP_REASON_LABEL[daemon.lastStopReason!] ?? daemon.lastStopReason}
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-red-950 border border-red-900 rounded text-[11px] text-red-200">
          <div className="font-medium">Action failed.</div>
          <div className="mt-1 break-words">{error}</div>
          <button
            onClick={() => setError(null)}
            className="mt-1 underline text-red-300 hover:text-red-100"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-neutral-800 flex gap-3 text-xs items-center">
        {daemon.running ? (
          <button
            onClick={handlePause}
            disabled={busy}
            className="px-2.5 py-1 bg-amber-200 text-amber-950 rounded hover:bg-amber-100 disabled:opacity-50 text-[11px]"
          >
            ⏸ Pause
          </button>
        ) : (
          <>
            <button
              onClick={handlePlay}
              disabled={busy}
              className="px-2.5 py-1 bg-emerald-300 text-emerald-950 rounded hover:bg-emerald-200 disabled:opacity-50 text-[11px]"
              title="Start continuous daemon"
            >
              ▶ Play
            </button>
            <button
              onClick={handleRunOnce}
              disabled={busy || loopState.kind === "running"}
              className="px-2.5 py-1 bg-neutral-100 text-neutral-900 rounded hover:bg-white disabled:opacity-50 text-[11px]"
              title="Run a single loop, then stop"
            >
              Run Once
            </button>
          </>
        )}
        <button
          onClick={onOpenFinder}
          className="text-neutral-400 hover:text-neutral-100"
        >
          Finder
        </button>
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
