import { useEffect, useState } from "react";
import { api, type DriftMetrics } from "../lib/tauri-bindings";

interface Props {
  instanceId: string;
  refreshTick: number;
}

interface Banner {
  level: "amber" | "red";
  text: string;
}

export function DriftWarnings({ instanceId, refreshTick }: Props) {
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
      text: "Network: OPEN — sandbox firewall is disabled. All tools have raw network access. Flip it back to off/gated in Settings when you're done exploring.",
    });
  } else if (m.network_access === "gated") {
    banners.push({
      level: "amber",
      text: `Network: GATED — sandbox allows TCP 80/443 to ${m.network_allowlist_len} allowlisted host(s).`,
    });
  }

  // SC-005 — tool-lag
  if (m.tool_lag >= 200) {
    banners.push({
      level: "red",
      text: `SC-005: ${m.tool_lag} Loops ohne neues Tool (Grenze 200). Diverge sollte ein Tool synthetisieren oder die Abstinenz dokumentieren.`,
    });
  } else if (m.tool_lag >= 100) {
    banners.push({
      level: "amber",
      text: `SC-005: ${m.tool_lag} Loops ohne neues Tool — Annäherung an die 200er-Grenze.`,
    });
  }

  // SC-004 — election diversity
  if (m.unanimous_streak >= 20) {
    banners.push({
      level: "red",
      text: `SC-004: ${m.unanimous_streak} aufeinanderfolgende unanime Elections — Filter-Versagen-Verdacht. RSI-Diagnose der Überinstanz angezeigt.`,
    });
  } else if (m.unanimous_streak >= 15) {
    banners.push({
      level: "amber",
      text: `SC-004: ${m.unanimous_streak} aufeinanderfolgende unanime Elections. Bei 20 wird automatische RSI-Diagnose erwartet.`,
    });
  }

  // Detection-degraded note: if half-ish of the window lacks markers
  if (
    m.elect_window > 0 &&
    m.elect_markers_missing >= Math.floor(m.elect_window / 2)
  ) {
    banners.push({
      level: "amber",
      text: `Drift-Detektion eingeschränkt: ${m.elect_markers_missing}/${m.elect_window} Elect-Files ohne ELECT_RESULT-Marker. SC-004-Tracking unzuverlässig.`,
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
