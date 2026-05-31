import { useState } from "react";
import {
  api,
  STIMULUS_KIND_LABELS,
  type StimulusKind,
} from "../lib/tauri-bindings";

interface Props {
  instanceId: string;
  onInjected: (kind: StimulusKind) => void;
}

interface Refinement {
  refined: string;
  notes: string[];
}

export function StimulusForm({ instanceId, onInjected }: Props) {
  const [kind, setKind] = useState<StimulusKind>("discrete");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [refinement, setRefinement] = useState<Refinement | null>(null);
  const [refinedBody, setRefinedBody] = useState("");
  const [refining, setRefining] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function refine() {
    if (!body.trim()) {
      setError("Nothing to refine — the body is empty.");
      return;
    }
    setRefining(true);
    setError(null);
    setOkMsg(null);
    try {
      const r = await api.refineStimulus(instanceId, kind, body);
      setRefinement(r);
      setRefinedBody(r.refined);
    } catch (e) {
      setError(String(e));
    } finally {
      setRefining(false);
    }
  }

  function discardRefinement() {
    setRefinement(null);
    setRefinedBody("");
  }

  async function inject(useRefined: boolean) {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const bodyToInject = useRefined ? refinedBody : body;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const path = await api.injectStimulus(
        instanceId,
        kind,
        title.trim(),
        bodyToInject,
      );
      setOkMsg(
        `Injected ${useRefined ? "refined" : "original"} → ${path}`,
      );
      setTitle("");
      setBody("");
      setRefinement(null);
      setRefinedBody("");
      onInjected(kind);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-neutral-800 rounded p-3 mb-4 bg-neutral-900/50">
      <div className="flex gap-2 mb-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as StimulusKind)}
          className="bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1 border border-neutral-700"
        >
          {(Object.keys(STIMULUS_KIND_LABELS) as StimulusKind[]).map((k) => (
            <option key={k} value={k}>
              {STIMULUS_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="flex-1 bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1 border border-neutral-700 placeholder-neutral-600"
        />
      </div>

      {refinement ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">
                Original
              </div>
              <textarea
                value={body}
                readOnly
                rows={8}
                className="w-full bg-neutral-900 text-neutral-400 text-xs rounded px-2 py-1.5 border border-neutral-800 resize-y font-mono"
              />
            </div>
            <div>
              <div className="text-[10px] text-emerald-400 uppercase tracking-wide mb-1">
                Refined (editable)
              </div>
              <textarea
                value={refinedBody}
                onChange={(e) => setRefinedBody(e.target.value)}
                rows={8}
                className="w-full bg-neutral-800 text-neutral-100 text-xs rounded px-2 py-1.5 border border-neutral-700 resize-y font-mono"
              />
            </div>
          </div>
          {refinement.notes.length > 0 && (
            <ul className="text-[11px] text-neutral-400 mb-2 list-disc list-inside space-y-0.5">
              {refinement.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              onClick={() => inject(true)}
              disabled={busy}
              className="px-3 py-1 text-[11px] bg-emerald-300 text-emerald-950 rounded hover:bg-emerald-200 disabled:opacity-50"
            >
              {busy ? "Injecting…" : "Inject refined"}
            </button>
            <button
              onClick={() => inject(false)}
              disabled={busy}
              className="px-3 py-1 text-[11px] bg-neutral-200 text-neutral-900 rounded hover:bg-white disabled:opacity-50"
            >
              Inject original
            </button>
            <button
              onClick={discardRefinement}
              disabled={busy}
              className="px-3 py-1 text-[11px] text-neutral-400 hover:text-neutral-200"
            >
              Discard refinement
            </button>
            {okMsg && (
              <span className="text-[11px] text-emerald-400 font-mono break-all">
                {okMsg}
              </span>
            )}
            {error && <span className="text-[11px] text-red-400">{error}</span>}
          </div>
        </>
      ) : (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Stimulus body — material for the organism to react to…"
            rows={4}
            className="w-full bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1.5 border border-neutral-700 placeholder-neutral-600 resize-y font-mono"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => inject(false)}
              disabled={busy || refining}
              className="px-3 py-1 text-[11px] bg-emerald-300 text-emerald-950 rounded hover:bg-emerald-200 disabled:opacity-50"
            >
              {busy ? "Injecting…" : "Inject stimulus"}
            </button>
            <button
              onClick={refine}
              disabled={busy || refining || !body.trim()}
              className="px-3 py-1 text-[11px] bg-neutral-200 text-neutral-900 rounded hover:bg-white disabled:opacity-50"
              title="Refine for clarity (not persuasiveness) — needs an Anthropic key"
            >
              {refining ? "Refining…" : "Refine for clarity"}
            </button>
            {okMsg && (
              <span className="text-[11px] text-emerald-400 font-mono break-all">
                {okMsg}
              </span>
            )}
            {error && <span className="text-[11px] text-red-400">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}
