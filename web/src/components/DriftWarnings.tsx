import { useEffect, useState } from "react";
import { api, type DriftMetrics } from "../lib/tauri-bindings";
import { useT } from "../lib/i18n";

interface Props {
  instanceId: string;
  refreshTick: number;
}

interface Banner {
  level: "amber" | "red";
  text: string;
}

export function DriftWarnings({ instanceId, refreshTick }: Props) {
  const { t } = useT();
  const [m, setM] = useState<DriftMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getDriftMetrics(instanceId)
      .then((x) => {
        if (!cancelled) setM(x);
      })
      .catch(() => {
        if (!cancelled) setM(null);
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, refreshTick]);

  if (!m) return null;

  const banners: Banner[] = [];

  // Phase 12 — network policy (shown first because it changes the firewall)
  if (m.network_access === "open") {
    banners.push({
      level: "red",
      text: t(
        "Network: OPEN — sandbox firewall is disabled. All tools have raw network access. Flip it back to off/gated in Settings when you're done exploring.",
      ),
    });
  } else if (m.network_access === "gated") {
    banners.push({
      level: "amber",
      text: t(
        "Network: GATED — sandbox allows TCP 80/443 to {n} allowlisted host(s).",
        { n: m.network_allowlist_len },
      ),
    });
  }

  // SC-005 — tool-lag
  if (m.tool_lag >= 200) {
    banners.push({
      level: "red",
      text: t(
        "SC-005: {n} loops without a new tool (limit 200). Diverge should synthesize a tool or document the abstinence.",
        { n: m.tool_lag },
      ),
    });
  } else if (m.tool_lag >= 100) {
    banners.push({
      level: "amber",
      text: t("SC-005: {n} loops without a new tool — approaching the 200 limit.", {
        n: m.tool_lag,
      }),
    });
  }

  // SC-004 — election diversity
  if (m.unanimous_streak >= 20) {
    banners.push({
      level: "red",
      text: t(
        "SC-004: {n} consecutive unanimous elections — suspected filter failure. RSI diagnosis by the superinstance is indicated.",
        { n: m.unanimous_streak },
      ),
    });
  } else if (m.unanimous_streak >= 15) {
    banners.push({
      level: "amber",
      text: t(
        "SC-004: {n} consecutive unanimous elections. At 20, automatic RSI diagnosis is expected.",
        { n: m.unanimous_streak },
      ),
    });
  }

  // Detection-degraded note: if half-ish of the window lacks markers
  if (
    m.elect_window > 0 &&
    m.elect_markers_missing >= Math.floor(m.elect_window / 2)
  ) {
    banners.push({
      level: "amber",
      text: t(
        "Drift detection limited: {missing}/{window} elect files without ELECT_RESULT marker. SC-004 tracking unreliable.",
        { missing: m.elect_markers_missing, window: m.elect_window },
      ),
    });
  }

  if (banners.length === 0) return null;

  return (
    <div className="mx-6 mt-3 space-y-2">
      {banners.map((b, i) => (
        <div
          key={i}
          className={`px-3 py-2 rounded text-sm ${
            b.level === "red"
              ? "bg-red-950 border border-red-900 text-red-200"
              : "bg-amber-950 border border-amber-900 text-amber-200"
          }`}
        >
          {b.text}
        </div>
      ))}
    </div>
  );
}
