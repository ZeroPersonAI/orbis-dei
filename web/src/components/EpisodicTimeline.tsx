import { useEffect, useMemo, useState } from "react";
import { api, type LoopEventRow } from "../lib/tauri-bindings";

interface Props {
  instanceId: string;
  refreshTick: number;
}

interface LoopGroup {
  loopN: number;
  files: string[];
}

export function EpisodicTimeline({ instanceId, refreshTick }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [events, setEvents] = useState<LoopEventRow[]>([]);
  const [expandedLoop, setExpandedLoop] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listEpisodicFiles(instanceId),
      api.loopEventsForInstance(instanceId),
    ])
      .then(([f, ev]) => {
        if (!cancelled) {
          setFiles(f);
          setEvents(ev);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, refreshTick]);

  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;
    api
      .readEpisodicFile(instanceId, selectedFile)
      .then((c) => {
        if (!cancelled) setFileContent(c);
      })
      .catch((e) => {
        if (!cancelled) setFileContent(`(could not read: ${e})`);
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, selectedFile, refreshTick]);

  const groups = useMemo<LoopGroup[]>(() => {
    const map = new Map<number, string[]>();
    for (const f of files) {
      const m = f.match(/^loop-(\d+)-/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (!map.has(n)) map.set(n, []);
      map.get(n)!.push(f);
    }
    return [...map.entries()]
      .map(([loopN, fs]) => ({ loopN, files: fs.sort() }))
      .sort((a, b) => b.loopN - a.loopN);
  }, [files]);

  // Per-loop integrate outcome, for a quick health glyph.
  const loopOutcome = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of events) {
      if (e.phase === "integrate" && e.outcome) m.set(e.loop_n, e.outcome);
    }
    return m;
  }, [events]);

  if (error) {
    return <div className="text-sm text-red-300">{error}</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="text-sm text-neutral-500">No episodic files yet.</div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Loop tree */}
      <div className="w-64 shrink-0 overflow-auto border-r border-neutral-800 pr-3">
        {groups.map((g) => {
          const expanded = expandedLoop === g.loopN;
          const outcome = loopOutcome.get(g.loopN);
          const glyph = outcome === "ok" ? "✓" : outcome ? "✕" : "·";
          return (
            <div key={g.loopN} className="mb-1">
              <button
                onClick={() =>
                  setExpandedLoop(expanded ? null : g.loopN)
                }
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-neutral-800 flex items-center gap-2"
              >
                <span className="text-neutral-500">{expanded ? "▾" : "▸"}</span>
                <span className="font-mono text-neutral-300">
                  loop {String(g.loopN).padStart(5, "0")}
                </span>
                <span
                  className={
                    outcome === "ok"
                      ? "text-emerald-500"
                      : outcome
                        ? "text-red-500"
                        : "text-neutral-600"
                  }
                >
                  {glyph}
                </span>
              </button>
              {expanded && (
                <div className="ml-5 mt-0.5">
                  {g.files.map((f) => {
                    const phase = f.replace(/^loop-\d+-/, "").replace(/\.md$/, "");
                    return (
                      <button
                        key={f}
                        onClick={() => setSelectedFile(f)}
                        className={`block w-full text-left px-2 py-0.5 text-[11px] rounded hover:bg-neutral-800 ${
                          selectedFile === f
                            ? "text-emerald-300"
                            : "text-neutral-400"
                        }`}
                      >
                        {phase}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* File content */}
      <div className="flex-1 overflow-auto">
        {selectedFile ? (
          <>
            <div className="text-[11px] text-neutral-500 mb-2 font-mono">
              {selectedFile}
            </div>
            <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
              {fileContent}
            </pre>
          </>
        ) : (
          <div className="text-sm text-neutral-600">
            Select a loop, then a phase file.
          </div>
        )}
      </div>
    </div>
  );
}
