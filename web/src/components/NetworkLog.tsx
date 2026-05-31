import { useEffect, useState } from "react";
import { api, type NetworkHistory } from "../lib/tauri-bindings";

interface Props {
  instanceId: string;
  refreshTick: number;
}

const POLICY_STYLES: Record<string, string> = {
  off: "bg-neutral-800 text-neutral-400 border-neutral-700",
  gated: "bg-amber-950 text-amber-300 border-amber-900",
  open: "bg-red-950 text-red-300 border-red-900",
};

export function NetworkLog({ instanceId, refreshTick }: Props) {
  const [h, setH] = useState<NetworkHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .networkHistory(instanceId)
      .then((x) => !cancelled && setH(x))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [instanceId, refreshTick]);

  if (error) return <div className="text-sm text-red-300">{error}</div>;
  if (!h) return <div className="text-sm text-neutral-500">Loading…</div>;

  const currentBadge = POLICY_STYLES[h.current_policy] ?? POLICY_STYLES.off;

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      <section className="border border-neutral-800 rounded p-3 bg-neutral-900/40 shrink-0">
        <div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-2">
          Current policy
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 text-xs font-mono rounded border ${currentBadge}`}
          >
            {h.current_policy}
          </span>
          {h.current_policy === "gated" && (
            <span className="text-[11px] text-neutral-400">
              {h.current_allowlist.length === 0 ? (
                <span className="text-amber-400">
                  allowlist empty — nothing actually reachable
                </span>
              ) : (
                <>
                  allowlist: {h.current_allowlist.join(", ")}
                </>
              )}
            </span>
          )}
          {h.current_policy === "open" && (
            <span className="text-[11px] text-red-400">
              sandbox firewall is OFF — every host reachable
            </span>
          )}
          {h.current_policy === "off" && (
            <span className="text-[11px] text-neutral-500">
              fully isolated — sandbox denies all network
            </span>
          )}
        </div>
        <div className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
          {h.note}
        </div>
      </section>

      <section className="flex-1 min-h-0">
        <div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-2">
          Recent loops with tool activity (window {h.window})
        </div>
        {h.entries.length === 0 ? (
          <div className="text-sm text-neutral-600">
            No tool runs recorded in the last {h.window} expands.
          </div>
        ) : (
          h.entries.map((e) => {
            const badge = POLICY_STYLES[e.network_policy] ?? POLICY_STYLES.off;
            return (
              <div
                key={e.loop_n}
                className="border border-neutral-800 rounded p-3 mb-3 bg-neutral-900/30"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-neutral-300">
                    loop {String(e.loop_n).padStart(5, "0")}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${badge}`}
                  >
                    {e.network_policy}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {e.tool_runs.length} tool run
                    {e.tool_runs.length === 1 ? "" : "s"}
                  </span>
                </div>
                {e.tool_runs.length === 0 ? (
                  <div className="text-[11px] text-neutral-600">
                    (no tools executed)
                  </div>
                ) : (
                  e.tool_runs.map((r, i) => (
                    <div key={i} className="mb-2 last:mb-0">
                      <div className="text-[11px] font-mono">
                        <span
                          className={
                            r.failed ? "text-red-400" : "text-emerald-400"
                          }
                        >
                          {r.failed ? "✗" : "✓"}
                        </span>{" "}
                        <span className="text-neutral-300">{r.tool}</span>
                        {r.exit_code !== null && (
                          <span className="text-neutral-500">
                            {" "}
                            · exit {r.exit_code}
                          </span>
                        )}
                      </div>
                      {r.output_excerpt && (
                        <pre className="text-[10px] font-mono text-neutral-400 whitespace-pre-wrap mt-1 pl-3 border-l border-neutral-800 leading-relaxed">
                          {r.output_excerpt}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
