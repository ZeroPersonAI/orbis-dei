import { useCallback, useEffect, useState } from "react";
import { api, type AutoConfig } from "../lib/tauri-bindings";

interface Props {
  instanceId: string;
}

const DEFAULT_REPLY_PROMPT =
  "Würdige echte Substanz, korrigiere sanft Fehlannahmen, führe das System " +
  "zum Wachstum. Antworte als Operator, prägnant. Reiz, kein Befehl.";
const DEFAULT_STIMULUS_PROMPT =
  "Verfasse einen vorausschauenden, kreativen Reiz zum Wachstum des Systems " +
  "Richtung AGI. Nutze ruhig Nebenthemen (Internet, Wikipedia, Wissenschaft). " +
  "Vermeide doppelte Reize.";

export function AutoModusTab({ instanceId }: Props) {
  const [config, setConfig] = useState<AutoConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cfg, status] = await Promise.all([
        api.getAutoConfig(instanceId),
        api.autoModeStatus(instanceId),
      ]);
      setConfig(cfg);
      setRunning(status);
    } catch (e) {
      setError(String(e));
    }
  }, [instanceId]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(
    async (next: AutoConfig) => {
      setBusy(true);
      setError(null);
      setOk(null);
      try {
        const saved = await api.setAutoConfig(instanceId, next);
        setConfig(saved);
        setRunning(await api.autoModeStatus(instanceId));
        setOk("Gespeichert und angewendet.");
      } catch (e) {
        setError(String(e));
        // re-sync from backend so the UI doesn't show an unsaved/failed state
        load();
      } finally {
        setBusy(false);
      }
    },
    [instanceId, load],
  );

  if (!config) {
    return (
      <div className="text-sm text-neutral-500">
        {error ? `Fehler: ${error}` : "Lade Auto-Modus…"}
      </div>
    );
  }

  const set = (patch: Partial<AutoConfig>) =>
    setConfig({ ...config, ...patch });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-medium text-neutral-200">Auto-Modus</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Der Operator-Agent dieser Instanz. Beantwortet Outbox-Nachrichten
          automatisch und/oder speist in einem Intervall neue Stimuli ein.
          Reize, keine Befehle — der Organismus entscheidet selbst.
        </p>
      </div>

      {/* Master switch */}
      <section className="bg-neutral-900 border border-neutral-800 rounded p-4 flex items-center justify-between">
        <label className="flex items-center gap-3 text-sm text-neutral-200">
          <input
            type="checkbox"
            checked={config.auto_mode_enabled}
            disabled={busy}
            onChange={(e) =>
              persist({ ...config, auto_mode_enabled: e.target.checked })
            }
            className="accent-emerald-500 w-4 h-4"
          />
          Auto-Modus aktiv
        </label>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            running
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-neutral-800 text-neutral-500"
          }`}
        >
          {running ? "läuft" : "gestoppt"}
        </span>
      </section>

      {/* Part 1: auto-reply */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={config.auto_reply_enabled}
            onChange={(e) => set({ auto_reply_enabled: e.target.checked })}
            className="accent-neutral-300"
          />
          <span className="font-medium">Auto-Antwort auf Outbox-Eingänge</span>
        </label>
        <p className="text-xs text-neutral-500 -mt-1 ml-6">
          Erkennt neue Nachrichten in der Outbox des Organismus und legt eine
          generierte Antwort in die Inbox (als <code>reply_to</code>-Thread).
        </p>
        <div className="ml-6">
          <label className="block text-xs text-neutral-400 mb-1.5">
            Richtung der Antworten
          </label>
          <textarea
            value={config.auto_reply_prompt ?? ""}
            placeholder={DEFAULT_REPLY_PROMPT}
            onChange={(e) =>
              set({ auto_reply_prompt: e.target.value || null })
            }
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
            rows={3}
          />
          <p className="text-[11px] text-neutral-600 mt-1">
            Leer = Standard-Richtung.
          </p>
        </div>
      </section>

      {/* Part 2: auto-stimulus */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={config.auto_stimulus_enabled}
            onChange={(e) => set({ auto_stimulus_enabled: e.target.checked })}
            className="accent-neutral-300"
          />
          <span className="font-medium">Auto-Stimulus im Intervall</span>
        </label>
        <p className="text-xs text-neutral-500 -mt-1 ml-6">
          Speist alle X Minuten einen frischen, nicht-redundanten Stimulus in
          die Inbox.
        </p>
        <div className="ml-6 space-y-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">
              Intervall (Minuten)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={config.auto_stimulus_interval_minutes}
              onChange={(e) =>
                set({
                  auto_stimulus_interval_minutes: Math.max(
                    1,
                    parseInt(e.target.value || "1", 10) || 1,
                  ),
                })
              }
              className="w-32 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">
              Richtung der Stimuli
            </label>
            <textarea
              value={config.auto_stimulus_prompt ?? ""}
              placeholder={DEFAULT_STIMULUS_PROMPT}
              onChange={(e) =>
                set({ auto_stimulus_prompt: e.target.value || null })
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
              rows={3}
            />
            <p className="text-[11px] text-neutral-600 mt-1">
              Leer = Standard-Richtung. Erstes Intervall startet nach dem
              Aktivieren.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => persist(config)}
          disabled={busy}
          className="px-4 py-2 text-sm rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
        >
          {busy ? "Speichern…" : "Speichern & Anwenden"}
        </button>
        {ok && <span className="text-xs text-emerald-400">{ok}</span>}
        {error && <span className="text-xs text-red-400">Fehler: {error}</span>}
      </div>

      <p className="text-[11px] text-neutral-600 border-t border-neutral-900 pt-3">
        Generierung läuft über das Routing dieser Instanz (starkes Modell unter
        Hybrid) und durch den Governor (Budget/Rate-Limits gelten). Auto-Modus
        ist unabhängig vom Loop-Daemon: Reize sammeln sich auch an, wenn die
        Instanz pausiert ist.
      </p>
    </div>
  );
}
