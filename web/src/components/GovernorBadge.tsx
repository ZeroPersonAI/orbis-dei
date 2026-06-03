import { useCallback, useEffect, useState } from "react";
import { api, type GovernorStatus } from "../lib/tauri-bindings";
import { useT } from "../lib/i18n";

interface Props {
  /** Refresh trigger — bump this number to force a re-fetch (e.g. after a loop completes). */
  refreshKey?: number;
}

const POLL_MS = 15_000;

export function GovernorBadge({ refreshKey = 0 }: Props) {
  const { t } = useT();
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
      <div className="text-[11px] text-red-300">{t("governor:")} {error}</div>
    );
  }
  if (!status) return null;

  return (
    <div className="flex items-center gap-3 text-[11px]">
      {status.queue_depth > 0 && (
        <span
          className="px-2 py-0.5 border border-sky-700 text-sky-300 rounded"
          title={t("Anthropic calls currently being rate-limited")}
        >
          ⏳ {t("{n} queued", { n: status.queue_depth })}
        </span>
      )}

      {status.breaker_open && (
        <span className="px-2 py-0.5 border border-red-700 text-red-300 rounded animate-pulse">
          ⚠ {t("breaker open")}
          {status.breaker_reopens_in_secs !== null && (
            <span className="ml-1 text-red-400">
              {t("({m}m)", { m: Math.ceil(status.breaker_reopens_in_secs / 60) })}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
