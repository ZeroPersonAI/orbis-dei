import {
  LOOP_PHASES,
  PROVIDER_LABELS,
  ROUTING_MODE_LABELS,
  type Provider,
  type RoutingMode,
} from "../lib/tauri-bindings";
import { useT } from "../lib/i18n";

interface Props {
  routingMode: RoutingMode;
  /** per-phase provider map; only meaningful when routingMode === "custom" */
  phaseMap: Record<string, Provider>;
  onChange: (mode: RoutingMode, phaseMap: Record<string, Provider>) => void;
}

/** Parse a phase_routing JSON string into a complete 6-phase map (defaults to anthropic). */
export function parsePhaseMap(json: string | null): Record<string, Provider> {
  let parsed: Record<string, string> = {};
  if (json) {
    try {
      parsed = JSON.parse(json);
    } catch {
      parsed = {};
    }
  }
  const map: Record<string, Provider> = {};
  for (const phase of LOOP_PHASES) {
    const v = parsed[phase];
    map[phase] =
      v === "openai" || v === "gemini" || v === "anthropic" ? v : "anthropic";
  }
  return map;
}

export function RoutingEditor({ routingMode, phaseMap, onChange }: Props) {
  const { t } = useT();
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-neutral-400 mb-1.5">{t("Provider")}</label>
        <select
          value={routingMode}
          onChange={(e) => onChange(e.target.value as RoutingMode, phaseMap)}
          className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
        >
          {(Object.entries(ROUTING_MODE_LABELS) as Array<[RoutingMode, string]>).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      {routingMode === "custom" && (
        <div className="space-y-2 border-l-2 border-neutral-800 pl-3">
          <p className="text-[11px] text-neutral-600">
            {t(
              "Provider per loop phase. The model per provider comes from settings.",
            )}
          </p>
          {LOOP_PHASES.map((phase) => (
            <div key={phase} className="flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-400 capitalize w-24">
                {phase}
              </span>
              <select
                value={phaseMap[phase] ?? "anthropic"}
                onChange={(e) =>
                  onChange(routingMode, {
                    ...phaseMap,
                    [phase]: e.target.value as Provider,
                  })
                }
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-neutral-600"
              >
                {(Object.entries(PROVIDER_LABELS) as Array<[Provider, string]>).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
