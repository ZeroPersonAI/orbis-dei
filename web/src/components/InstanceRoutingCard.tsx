import { useEffect, useState } from "react";
import { api, type Provider, type RoutingMode } from "../lib/tauri-bindings";
import { RoutingEditor, parsePhaseMap } from "./RoutingEditor";
import { useT } from "../lib/i18n";

interface Props {
  instanceId: string;
  refreshTick?: number;
}

/** Per-instance routing editor, shown as a Dashboard card. */
export function InstanceRoutingCard({ instanceId, refreshTick }: Props) {
  const { t } = useT();
  const [routing, setRouting] = useState<RoutingMode>("anthropic");
  const [phaseMap, setPhaseMap] = useState<Record<string, Provider>>(
    parsePhaseMap(null),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInstance(instanceId)
      .then((i) => {
        setRouting(i.routing_mode);
        setPhaseMap(parsePhaseMap(i.phase_routing));
      })
      .catch(() => {});
  }, [instanceId, refreshTick]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const pr = routing === "custom" ? JSON.stringify(phaseMap) : undefined;
      await api.setInstanceRouting(instanceId, routing, pr);
      setMsg(t("Saved."));
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
        {t("Routing")}
      </h3>
      <RoutingEditor
        routingMode={routing}
        phaseMap={phaseMap}
        onChange={(m, pm) => {
          setRouting(m);
          setPhaseMap(pm);
        }}
      />
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={save}
          disabled={busy}
          className="px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
        >
          {busy ? t("Saving…") : t("Save")}
        </button>
        {msg && <span className="text-[11px] text-neutral-400">{msg}</span>}
      </div>
    </div>
  );
}
