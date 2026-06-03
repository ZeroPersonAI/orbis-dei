import type { CouplingLevel } from "../lib/tauri-bindings";
import { useT } from "../lib/i18n";

interface Props {
  level: CouplingLevel;
  onChange: (level: CouplingLevel) => void;
  disabled?: boolean;
}

const LEVELS: {
  value: CouplingLevel;
  label: string;
  hint: string;
  accent: string;
}[] = [
  {
    value: "mirror",
    label: "Mirror",
    hint: "Closed: no network, no tools. The organism only metabolizes its own corpus and operator stimuli.",
    accent: "border-sky-600 bg-sky-950/40 text-sky-200",
  },
  {
    value: "gated",
    label: "Gated",
    hint: "Supervised coupling: tools run; network limited to the allowlisted hosts (TCP 80/443).",
    accent: "border-amber-600 bg-amber-950/40 text-amber-200",
  },
  {
    value: "open",
    label: "Open",
    hint: "Full coupling: tools run with raw network access. Red-warned every loop — a deliberate experiment.",
    accent: "border-red-600 bg-red-950/40 text-red-200",
  },
];

/** Per-instance coupling-level selector (mirror / gated / open). */
export function CouplingEditor({ level, onChange, disabled }: Props) {
  const { t } = useT();
  const current = LEVELS.find((l) => l.value === level) ?? LEVELS[0];
  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1.5">{t("Coupling")}</label>
      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map((l) => {
          const active = l.value === level;
          return (
            <button
              key={l.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(l.value)}
              className={`px-2 py-1.5 text-xs rounded border transition disabled:opacity-50 ${
                active
                  ? l.accent
                  : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              {t(l.label)}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-neutral-600 mt-1.5">{t(current.hint)}</p>
    </div>
  );
}
