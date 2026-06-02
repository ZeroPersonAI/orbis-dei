import { useCallback, useEffect, useState } from "react";
import {
  api,
  type Instance,
  type RoutingMode,
} from "../lib/tauri-bindings";
import { NewInstanceDialog } from "../components/NewInstanceDialog";
import { InstanceCard } from "../components/InstanceCard";
import { GovernorBadge } from "../components/GovernorBadge";
import { useRunningDaemonCount } from "../lib/daemon-events";
import { useT } from "../lib/i18n";

interface Props {
  onOpenSettings: () => void;
  onOpenInstance: (id: string) => void;
}

export function HabitatView({ onOpenSettings, onOpenInstance }: Props) {
  const { t } = useT();
  const [governorRefresh, setGovernorRefresh] = useState(0);
  const runningDaemons = useRunningDaemonCount(governorRefresh);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.listInstances();
      setInstances(list);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
    setGovernorRefresh((n) => n + 1);
  }, []);

  useEffect(() => {
    refresh();
    api
      .hasAnthropicKey()
      .then(setHasKey)
      .catch(() => setHasKey(null));
  }, [refresh]);

  async function handleCreate(
    name: string,
    routingMode: RoutingMode,
    phaseRouting: string | undefined,
  ) {
    try {
      await api.createInstance(name, routingMode, phaseRouting);
      setShowNew(false);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !window.confirm(
        t(
          'Delete instance "{name}"?\n\nThis removes its folder, git history, and database row. Cannot be undone.',
          { name },
        ),
      )
    )
      return;
    try {
      await api.deleteInstance(id);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-neutral-950 text-neutral-100">
      <header className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light tracking-tight">Orbis Dei</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t("Habitat")} — {instances.length}{" "}
            {instances.length === 1 ? t("instance") : t("instances")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <GovernorBadge refreshKey={governorRefresh} />
          {runningDaemons > 0 && (
            <button
              onClick={async () => {
                if (
                  !window.confirm(
                    runningDaemons === 1
                      ? t("Pause the 1 running daemon?")
                      : t("Pause all {n} running daemons?", {
                          n: runningDaemons,
                        }),
                  )
                )
                  return;
                try {
                  await api.pauseAllDaemons();
                  await refresh();
                } catch (e) {
                  setError(String(e));
                }
              }}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-500 transition"
              title={t("Stop every running daemon immediately")}
            >
              ⏸ {t("Pause All")} ({runningDaemons})
            </button>
          )}
          <button
            onClick={onOpenSettings}
            title={t("Settings")}
            className="text-neutral-400 hover:text-neutral-100 text-xl leading-none"
          >
            ⚙
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="px-3 py-1.5 text-sm bg-neutral-100 text-neutral-900 rounded hover:bg-white transition"
          >
            {t("New Instance")}
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 px-3 py-2 bg-red-950 border border-red-900 rounded text-sm text-red-200 flex items-start gap-3">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-100 underline"
          >
            {t("dismiss")}
          </button>
        </div>
      )}

      <main className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
            {t("Loading…")}
          </div>
        ) : instances.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-500">
            <div className="text-center max-w-md">
              <p className="text-sm text-neutral-300">{t("Welcome.")}</p>
              <p className="text-xs mt-2 leading-relaxed">
                {t(
                  "Orbis Dei is an autopoietic organism that writes, runs, and reviews itself one six-phase loop at a time. This app hosts many such organisms side by side — each isolated, with its own corpus, git history, and constitution.",
                )}
              </p>
              {hasKey === false && (
                <p className="text-xs mt-3 leading-relaxed text-amber-300/80">
                  {t("Tip: open")}{" "}
                  <button
                    onClick={onOpenSettings}
                    className="underline hover:text-amber-200"
                  >
                    {t("Settings")}
                  </button>{" "}
                  {t("to add an Anthropic API key for remote inference, or pick the")}{" "}
                  <span className="text-neutral-300">{t("All Ollama")}</span>{" "}
                  {t("routing mode when you create the instance.")}
                </p>
              )}
              <p className="text-xs mt-3 leading-relaxed">
                {t("Click")}{" "}
                <span className="text-neutral-300">{t("New Instance")}</span>{" "}
                {t("to bring one into being.")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {instances.map((inst) => (
              <InstanceCard
                key={inst.id}
                instance={inst}
                onOpenFinder={() => api.openInFinder(inst.id)}
                onDelete={() => handleDelete(inst.id, inst.name)}
                onRefresh={refresh}
                onOpen={() => onOpenInstance(inst.id)}
              />
            ))}
          </div>
        )}
      </main>

      {showNew && (
        <NewInstanceDialog
          onCancel={() => setShowNew(false)}
          onConfirm={handleCreate}
        />
      )}
    </div>
  );
}
