import { useEffect, useMemo, useState } from "react";
import {
  api,
  type ToolFile,
  type ToolUsage,
} from "../lib/tauri-bindings";

interface Props {
  instanceId: string;
  refreshTick: number;
}

export function ToolsInventory({ instanceId, refreshTick }: Props) {
  const [tools, setTools] = useState<ToolFile[]>([]);
  const [usage, setUsage] = useState<ToolUsage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listTools(instanceId), api.toolUsageStats(instanceId)])
      .then(([t, u]) => {
        if (!cancelled) {
          setTools(t);
          setUsage(u);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [instanceId, refreshTick]);

  const usageByTool = useMemo(() => {
    const m = new Map<string, ToolUsage>();
    for (const u of usage) m.set(u.tool, u);
    return m;
  }, [usage]);

  const selectedTool = tools.find((t) => t.rel_path === selected) || null;
  const selectedUsage = selected ? usageByTool.get(selected) : null;

  if (error) return <div className="text-sm text-red-300">{error}</div>;

  if (tools.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        No tools yet. The organism writes tools under{" "}
        <code className="text-neutral-400">tools/native/</code> during the Expand
        phase.
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      <div className="w-80 shrink-0 overflow-auto border-r border-neutral-800 pr-3">
        <div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-2">
          {tools.length} tool{tools.length === 1 ? "" : "s"} · {usage.length} with
          run history
        </div>
        {tools.map((t) => {
          const u = usageByTool.get(t.rel_path);
          const selectedRow = selected === t.rel_path;
          const summary = u
            ? `${u.runs} run${u.runs === 1 ? "" : "s"} · ${u.successes}✓ ${u.failures}✗`
            : "no recorded runs";
          return (
            <button
              key={t.rel_path}
              onClick={() => setSelected(t.rel_path)}
              className={`block w-full text-left px-2 py-1.5 mb-0.5 rounded hover:bg-neutral-800 ${
                selectedRow ? "bg-neutral-800" : ""
              }`}
            >
              <div
                className={`text-xs font-mono truncate ${
                  selectedRow ? "text-emerald-300" : "text-neutral-300"
                }`}
              >
                {t.name}
              </div>
              <div className="text-[10px] text-neutral-500 truncate font-mono">
                {t.rel_path.replace(/\/[^/]+$/, "")} · {humanSize(t.size)} ·{" "}
                {summary}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {selectedTool ? (
          <>
            <div className="text-xs text-neutral-400 font-mono mb-1">
              {selectedTool.rel_path}
            </div>
            <div className="text-[11px] text-neutral-500 mb-2">
              {humanSize(selectedTool.size)} · modified{" "}
              {selectedTool.modified_at.slice(0, 19).replace("T", " ")}
              {selectedTool.shebang && (
                <>
                  {" · "}
                  <span className="font-mono">{selectedTool.shebang}</span>
                </>
              )}
            </div>
            {selectedUsage && (
              <div className="mb-3 text-[11px] text-neutral-400 border border-neutral-800 rounded p-2 bg-neutral-900/40">
                <div>
                  <span className="text-neutral-200 font-mono">
                    {selectedUsage.runs}
                  </span>{" "}
                  run{selectedUsage.runs === 1 ? "" : "s"} in the last 50
                  loops —{" "}
                  <span className="text-emerald-400">
                    {selectedUsage.successes}✓
                  </span>{" "}
                  <span className="text-red-400">
                    {selectedUsage.failures}✗
                  </span>
                </div>
                {selectedUsage.last_loop !== null && (
                  <div className="text-neutral-500 mt-0.5">
                    last seen loop {selectedUsage.last_loop}
                    {selectedUsage.last_exit !== null && (
                      <> · exit {selectedUsage.last_exit}</>
                    )}
                  </div>
                )}
              </div>
            )}
            <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
              {selectedTool.content}
              {selectedTool.content_truncated && "\n\n…[truncated]"}
            </pre>
          </>
        ) : (
          <div className="text-sm text-neutral-600">
            Select a tool to inspect it.
          </div>
        )}
      </div>
    </div>
  );
}

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
