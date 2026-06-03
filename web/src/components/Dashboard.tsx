import { useEffect, useState } from "react";
import {
  api,
  ROUTING_MODE_LABELS,
  type DriftMetrics,
  type Instance,
  type InvariantsSnapshot,
} from "../lib/tauri-bindings";
import { InstanceRoutingCard } from "./InstanceRoutingCard";
import { useT } from "../lib/i18n";

interface Props {
  instanceId: string;
  refreshTick: number;
}

interface Data {
  instance: Instance;
  invariants: InvariantsSnapshot;
  drift: DriftMetrics;
  toolCount: number;
  inboxCount: number;
  standingCount: number;
  outboxCount: number;
  processedCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-neutral-600 text-neutral-300",
  running: "bg-emerald-500 text-emerald-50",
  paused: "bg-amber-500 text-amber-950",
  error: "bg-red-500 text-red-50",
  boredom_pause: "bg-sky-500 text-sky-950",
};

const NETWORK_BADGE: Record<string, string> = {
  off: "bg-neutral-800 text-neutral-300 border-neutral-700",
  gated: "bg-amber-950 text-amber-300 border-amber-900",
  open: "bg-red-950 text-red-300 border-red-900",
};

export function Dashboard({ instanceId, refreshTick }: Props) {
  const { t } = useT();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getInstance(instanceId),
      api.getInvariantsSnapshot(instanceId),
      api.getDriftMetrics(instanceId),
      api.listTools(instanceId),
      api.listInbox(instanceId),
      api.listStanding(instanceId),
      api.listOutbox(instanceId),
      api.listProcessed(instanceId),
    ])
      .then(
        ([
          instance,
          invariants,
          drift,
          tools,
          inbox,
          standing,
          outbox,
          processed,
        ]) => {
          if (!cancelled) {
            setD({
              instance,
              invariants,
              drift,
              toolCount: tools.length,
              inboxCount: inbox.length,
              standingCount: standing.length,
              outboxCount: outbox.length,
              processedCount: processed.length,
            });
            setError(null);
          }
        },
      )
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [instanceId, refreshTick]);

  if (error) return <div className="text-sm text-red-300">{error}</div>;
  if (!d)
    return (
      <div className="text-sm text-neutral-500">{t("Loading dashboard…")}</div>
    );

  const statusKey = d.instance.status;
  const statusColor = STATUS_COLORS[statusKey] ?? STATUS_COLORS.idle;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Identity */}
      <Card title={t("Status")}>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-light text-neutral-100">
            {t("loop")} {d.invariants.loop_n}
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] rounded uppercase tracking-wide ${statusColor}`}
          >
            {statusKey.replace("_", " ")}
          </span>
        </div>
        <KV label={t("Phase")}>{d.instance.current_phase ?? "—"}</KV>
        <KV label={t("Routing")}>
          {ROUTING_MODE_LABELS[d.instance.routing_mode] ?? d.instance.routing_mode}
        </KV>
        <KV label={t("Loops since stimulus")}>
          {d.instance.loops_since_last_stimulus}
        </KV>
        <KV label={t("Last stimulus")}>
          {d.instance.last_stimulus_at
            ? d.instance.last_stimulus_at.slice(0, 19).replace("T", " ")
            : t("never")}
        </KV>
      </Card>

      <InstanceRoutingCard instanceId={instanceId} refreshTick={refreshTick} />

      {/* SP-I integrity grid */}
      <Card
        title={t("Structural integrity (SP-I)")}
        accent={d.invariants.all_passed ? "emerald" : "red"}
        className="md:col-span-1 xl:col-span-2"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
          {d.invariants.report.checks.map((c) => (
            <div
              key={c.id}
              className="flex items-baseline gap-2 text-[11px]"
              title={c.detail}
            >
              <span
                className={`font-mono text-[10px] px-1 rounded ${
                  c.passed
                    ? "bg-emerald-950 text-emerald-300"
                    : "bg-red-950 text-red-300"
                }`}
              >
                {c.passed ? t("PASS") : t("FAIL")}
              </span>
              <span className="text-neutral-300 font-mono whitespace-nowrap">
                {c.id}
              </span>
              <span className="text-neutral-500 truncate">{c.name}</span>
            </div>
          ))}
        </div>
        {!d.invariants.all_passed && (
          <div className="mt-2 text-[11px] text-red-300 border-t border-red-900/40 pt-2">
            {t(
              "The next review phase would roll back — check the missing checks.",
            )}
          </div>
        )}
      </Card>

      {/* Drift signals */}
      <Card title={t("Drift signals")}>
        <Signal
          label={t("Tool lag (SC-005)")}
          value={d.drift.tool_lag}
          unit={t("loops · last new: {loop}", { loop: d.drift.last_tool_loop })}
          level={
            d.drift.tool_lag >= 200
              ? "red"
              : d.drift.tool_lag >= 100
                ? "amber"
                : "ok"
          }
        />
        <Signal
          label={t("Unanimous streak (SC-004)")}
          value={d.drift.unanimous_streak}
          unit={t("of max {n} in the window", { n: d.drift.elect_window })}
          level={
            d.drift.unanimous_streak >= 20
              ? "red"
              : d.drift.unanimous_streak >= 15
                ? "amber"
                : "ok"
          }
        />
        <Signal
          label={t("Elect markers missing")}
          value={d.drift.elect_markers_missing}
          unit={t("of {n}", { n: d.drift.elect_window })}
          level={
            d.drift.elect_markers_missing >= d.drift.elect_window / 2
              ? "amber"
              : "ok"
          }
        />
      </Card>

      {/* Network */}
      <Card title={t("Network")}>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-xs font-mono rounded border ${
              NETWORK_BADGE[d.drift.network_access] ?? NETWORK_BADGE.off
            }`}
          >
            {d.drift.network_access}
          </span>
          {d.drift.network_access === "gated" && (
            <span className="text-[11px] text-neutral-400">
              {t("{n} host(s)", { n: d.drift.network_allowlist_len })}
            </span>
          )}
        </div>
        <div className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
          {d.drift.network_access === "off" &&
            t("Sandbox denies all networking. Tools are fully isolated.")}
          {d.drift.network_access === "gated" &&
            t("Sandbox allows TCP 80/443 only to the allowlisted hosts.")}
          {d.drift.network_access === "open" &&
            t("Sandbox firewall off. Tools have raw network access.")}
        </div>
      </Card>

      {/* Activity */}
      <Card title={t("Activity")}>
        <KV label={t("Tools")}>{d.toolCount}</KV>
        <KV label={t("Stimuli inbox")}>{d.inboxCount}</KV>
        <KV label={t("Standing concerns")}>{d.standingCount}</KV>
        <KV label={t("Outbox")}>{d.outboxCount}</KV>
        <KV label={t("Processed archive")}>{d.processedCount}</KV>
      </Card>

      {/* Warnings (non-fatal) — always present, even if empty, for layout stability */}
      <Card
        title={t("Warnings")}
        accent={d.invariants.report.warnings.length > 0 ? "amber" : undefined}
      >
        {d.invariants.report.warnings.length === 0 ? (
          <div className="text-[11px] text-neutral-500">
            {t("No non-fatal warnings.")}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {d.invariants.report.warnings.map((w, i) => (
              <li
                key={i}
                className="text-[11px] text-amber-300 leading-relaxed"
              >
                {w}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  accent,
  className,
  children,
}: {
  title: string;
  accent?: "emerald" | "amber" | "red";
  className?: string;
  children: React.ReactNode;
}) {
  const ring =
    accent === "emerald"
      ? "border-emerald-900/60"
      : accent === "amber"
        ? "border-amber-900/60"
        : accent === "red"
          ? "border-red-900/60"
          : "border-neutral-800";
  return (
    <div
      className={`border ${ring} bg-neutral-900/40 rounded p-3 ${
        className ?? ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-[11px] py-0.5">
      <span className="text-neutral-500 truncate">{label}</span>
      <span className="text-neutral-200 font-mono truncate text-right">
        {children}
      </span>
    </div>
  );
}

function Signal({
  label,
  value,
  unit,
  level,
}: {
  label: string;
  value: number;
  unit: string;
  level: "ok" | "amber" | "red";
}) {
  const color =
    level === "red"
      ? "text-red-300"
      : level === "amber"
        ? "text-amber-300"
        : "text-emerald-300";
  return (
    <div className="py-1">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`text-lg font-mono ${color}`}>{value}</span>
        <span className="text-[10px] text-neutral-500 truncate">{unit}</span>
      </div>
    </div>
  );
}
