import { useEffect, useState } from "react";
import {
  api,
  type StimulusEntry,
  type StimulusKind,
} from "../lib/tauri-bindings";
import { StimulusForm } from "./StimulusForm";
import { useT } from "../lib/i18n";

interface Props {
  instanceId: string;
  refreshTick: number;
  /** Called after a successful injection so the parent can refresh instance state. */
  onStimulusInjected: () => void;
}

type Cat = "inbox" | "standing" | "outbox" | "processed";

const CAT_LABELS: Record<Cat, string> = {
  inbox: "Inbox",
  standing: "Standing",
  outbox: "Outbox",
  processed: "Processed",
};

export function StimulusInbox({
  instanceId,
  refreshTick,
  onStimulusInjected,
}: Props) {
  const { t } = useT();
  const [cat, setCat] = useState<Cat>("inbox");
  const [entries, setEntries] = useState<StimulusEntry[]>([]);
  const [selected, setSelected] = useState<StimulusEntry | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localTick, setLocalTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load =
      cat === "inbox"
        ? api.listInbox
        : cat === "standing"
          ? api.listStanding
          : cat === "outbox"
            ? api.listOutbox
            : api.listProcessed;
    load(instanceId)
      .then((e) => {
        if (!cancelled) {
          setEntries(e);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, cat, refreshTick, localTick]);

  useEffect(() => {
    setSelected(null);
    setContent("");
  }, [cat]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    api
      .readStimulus(instanceId, selected.category, selected.name)
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch((e) => {
        if (!cancelled) setContent(t("(could not read: {error})", { error: String(e) }));
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, selected]);

  function handleInjected(kind: StimulusKind) {
    if (kind === "discrete") setCat("inbox");
    else if (kind === "standing") setCat("standing");
    setLocalTick((t) => t + 1);
    onStimulusInjected();
  }

  return (
    <div className="h-full flex flex-col">
      <StimulusForm instanceId={instanceId} onInjected={handleInjected} />

      <div className="flex gap-1 mb-3">
        {(Object.keys(CAT_LABELS) as Cat[]).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-2.5 py-1 text-[11px] rounded ${
              cat === c
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t(CAT_LABELS[c])}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-red-300 mb-2">{error}</div>}

      {entries.length === 0 ? (
        <div className="text-sm text-neutral-600">
          {t("No stimuli in {category}.", {
            category: t(CAT_LABELS[cat]).toLowerCase(),
          })}
        </div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="w-72 shrink-0 overflow-auto border-r border-neutral-800 pr-3">
            {entries.map((e) => (
              <button
                key={`${e.category}/${e.name}`}
                onClick={() => setSelected(e)}
                className={`block w-full text-left px-2 py-1.5 mb-0.5 rounded hover:bg-neutral-800 ${
                  selected?.name === e.name && selected?.category === e.category
                    ? "bg-neutral-800"
                    : ""
                }`}
              >
                <div
                  className={`text-[11px] font-mono truncate ${
                    selected?.name === e.name &&
                    selected?.category === e.category
                      ? "text-emerald-300"
                      : "text-neutral-300"
                  }`}
                >
                  {e.name}
                </div>
                <div className="text-[10px] text-neutral-600 truncate">
                  {e.preview.replace(/\s+/g, " ").trim()}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {selected ? (
              <>
                <div className="text-[11px] text-neutral-500 mb-2 font-mono">
                  {selected.category}/{selected.name}
                </div>
                <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
                  {content}
                </pre>
              </>
            ) : (
              <div className="text-sm text-neutral-600">
                {t("Select a stimulus to read it.")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
