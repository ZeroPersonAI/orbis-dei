import { useCallback, useEffect, useState } from "react";
import { api, type GovernorStatus } from "../lib/tauri-bindings";

interface Props {
  /** Refresh trigger — bump this number to force a re-fetch (e.g. after a loop completes). */
  refreshKey?: number;
}

const POLL_MS = 15_000;

export function GovernorBadge({ refreshKey = 0 }: Props) {
  const [status, setStatus] = useState<GovernorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    try {
      const s = await api.getGovernorStatus();
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    fetchOnce();
    const id = window.setInterval(fetchOnce, POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchOnce, refreshKey]);

  if (error) {
    return (
      <div className="text-[11px] text-red-300">governor: {error}</div>
    );
  }
  if (!status) return null;

  const pct =
    status.daily_budget_usd > 0
      ? (status.daily_spent_usd / status.daily_budget_usd) * 100
      : 0;

  const budgetClass =
    pct >= 95
      ? "text-red-300 border-red-700"
      : pct >= 75
        ? "text-amber-300 border-amber-700"
        : "text-neutral-300 border-neutral-700";

  return (
    <div className="flex items-center gap-3 text-[11px]">
      <span
        className={`px-2 py-0.5 border rounded font-mono ${budgetClass}`}
        title={`monthly: $${status.monthly_spent_usd.toFixed(2)} / $${status.monthly_budget_usd.toFixed(2)}`}
      >
        ${status.daily_spent_usd.toFixed(2)} / $
        {status.daily_budget_usd.toFixed(2)}
        <span className="text-neutral-500 ml-1">({pct.toFixed(0)}%)</span>
      </span>

      {status.queue_depth > 0 && (
        <span
          className="px-2 py-0.5 border border-sky-700 text-sky-300 rounded"
          title="Anthropic calls currently being rate-limited"
        >
          ⏳ {status.queue_depth} queued
        </span>
      )}

      {status.breaker_open && (
        <span className="px-2 py-0.5 border border-red-700 text-red-300 rounded animate-pulse">
          ⚠ breaker open
          {status.breaker_reopens_in_secs !== null && (
            <span className="ml-1 text-red-400">
              ({Math.ceil(status.breaker_reopens_in_secs / 60)}m)
            </span>
          )}
        </span>
      )}
    </div>
  );
}
