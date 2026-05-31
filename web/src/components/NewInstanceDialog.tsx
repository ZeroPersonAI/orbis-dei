import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  type Provider,
  type RoutingMode,
} from "../lib/tauri-bindings";
import { RoutingEditor, parsePhaseMap } from "./RoutingEditor";

interface Props {
  onCancel: () => void;
  onConfirm: (
    name: string,
    routingMode: RoutingMode,
    phaseRouting?: string,
  ) => Promise<void>;
}

export function NewInstanceDialog({ onCancel, onConfirm }: Props) {
  const [name, setName] = useState("");
  const [routing, setRouting] = useState<RoutingMode>("anthropic");
  const [phaseMap, setPhaseMap] = useState<Record<string, Provider>>(
    parsePhaseMap(null),
  );
  const [submitting, setSubmitting] = useState(false);

  // Pull the user's preferred default routing from settings on mount.
  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        const mode = s.default_routing_mode as RoutingMode;
        if (mode in { anthropic: 1, openai: 1, gemini: 1, custom: 1 }) {
          setRouting(mode);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const phaseRouting =
        routing === "custom" ? JSON.stringify(phaseMap) : undefined;
      await onConfirm(name.trim(), routing, phaseRouting);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 w-full max-w-md mx-4"
      >
        <h2 className="text-lg font-light">New Instance</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-5">
          A new isolated Orbis Dei organism. Filesystem layout, constitution,
          and git repository are initialized in one transactional step.
        </p>

        <label className="block text-xs text-neutral-400 mb-1.5">Name</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. lauf-3-alpha"
          className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600 mb-4"
          maxLength={120}
        />

        <RoutingEditor
          routingMode={routing}
          phaseMap={phaseMap}
          onChange={(mode, map) => {
            setRouting(mode);
            setPhaseMap(map);
          }}
        />
        <p className="text-[10px] text-neutral-600 mt-2">
          Provider + Modell (aus Einstellungen) je Loop-Phase. Der nötige
          API-Key muss in den Einstellungen hinterlegt sein.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="px-4 py-1.5 text-sm bg-neutral-100 text-neutral-900 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
