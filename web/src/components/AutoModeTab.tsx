import { useCallback, useEffect, useState } from "react";
import { api, type AutoConfig } from "../lib/tauri-bindings";
import { useT } from "../lib/i18n";

interface Props {
  instanceId: string;
}

export function AutoModeTab({ instanceId }: Props) {
  const { t } = useT();
  const DEFAULT_REPLY_PROMPT = t(
    "Honor genuine substance, gently correct misconceptions, guide the system " +
      "toward growth. Reply as the operator, concise. A stimulus, not a command.",
  );
  const DEFAULT_STIMULUS_PROMPT = t(
    "Compose a forward-looking, creative stimulus for the system's growth " +
      "toward AGI. Feel free to use adjacent topics (internet, Wikipedia, science). " +
      "Avoid duplicate stimuli.",
  );
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
        setOk(t("Saved and applied."));
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
        {error ? t("Error: {error}", { error }) : t("Loading auto mode…")}
      </div>
    );
  }

  const set = (patch: Partial<AutoConfig>) =>
    setConfig({ ...config, ...patch });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-medium text-neutral-200">{t("Auto mode")}</h2>
        <p className="text-xs text-neutral-500 mt-1">
          {t(
            "The operator agent of this instance. Replies to outbox messages " +
              "automatically and/or feeds new stimuli at an interval. " +
              "Stimuli, not commands — the organism decides for itself.",
          )}
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
          {t("Auto mode active")}
        </label>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            running
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-neutral-800 text-neutral-500"
          }`}
        >
          {running ? t("running") : t("stopped")}
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
          <span className="font-medium">{t("Auto-reply to outbox arrivals")}</span>
        </label>
        <p className="text-xs text-neutral-500 -mt-1 ml-6">
          {t(
            "Detects new messages in the organism's outbox and places a " +
              "generated reply into the inbox (as a",
          )}{" "}
          <code>reply_to</code>{t("-thread).")}
        </p>
        <div className="ml-6">
          <label className="block text-xs text-neutral-400 mb-1.5">
            {t("Direction of the replies")}
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
            {t("Empty = default direction.")}
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
          <span className="font-medium">{t("Auto-stimulus at an interval")}</span>
        </label>
        <p className="text-xs text-neutral-500 -mt-1 ml-6">
          {t(
            "Feeds a fresh, non-redundant stimulus into the inbox every X minutes.",
          )}
        </p>
        <div className="ml-6 space-y-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">
              {t("Interval (minutes)")}
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
              {t("Direction of the stimuli")}
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
              {t(
                "Empty = default direction. First interval starts after activation.",
              )}
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
          {busy ? t("Saving…") : t("Save & Apply")}
        </button>
        {ok && <span className="text-xs text-emerald-400">{ok}</span>}
        {error && (
          <span className="text-xs text-red-400">{t("Error: {error}", { error })}</span>
        )}
      </div>

      <p className="text-[11px] text-neutral-600 border-t border-neutral-900 pt-3">
        {t(
          "Generation runs through this instance's routing (strong model under " +
            "Hybrid) and through the Governor (rate limits apply). Auto mode stays " +
            "armed but dormant while the instance is paused — it only injects while " +
            "the loop is running.",
        )}
      </p>
    </div>
  );
}
