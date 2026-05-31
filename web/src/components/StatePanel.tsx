import { useEffect, useState } from "react";
import { api } from "../lib/tauri-bindings";

interface Props {
  instanceId: string;
  /** Bumped by the corpus watcher — triggers a re-read. */
  refreshTick: number;
}

export function StatePanel({ instanceId, refreshTick }: Props) {
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .readStateMd(instanceId)
      .then((c) => {
        if (!cancelled) {
          setContent(c);
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

  if (error) {
    return <div className="text-sm text-red-300">{error}</div>;
  }

  return (
    <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
      {content || "(empty)"}
    </pre>
  );
}
