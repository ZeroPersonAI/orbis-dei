import { useT } from "../lib/i18n";

const PHASES = [
  "observe",
  "diverge",
  "elect",
  "expand",
  "review",
  "integrate",
] as const;

interface Props {
  /** The phase currently running, or null when idle. */
  activePhase: string | null;
}

export function PhaseIndicator({ activePhase }: Props) {
  const { t } = useT();
  const activeIdx = activePhase
    ? PHASES.indexOf(activePhase as (typeof PHASES)[number])
    : -1;

  return (
    <div className="flex items-center gap-1 text-[10px]">
      {PHASES.map((phase, idx) => {
        const isActive = idx === activeIdx;
        const isDone = activeIdx >= 0 && idx < activeIdx;
        const dotClass = isActive
          ? "bg-emerald-400 animate-pulse"
          : isDone
            ? "bg-emerald-700"
            : "bg-neutral-700";
        const labelClass = isActive
          ? "text-emerald-300"
          : isDone
            ? "text-neutral-400"
            : "text-neutral-600";
        return (
          <div key={phase} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${dotClass}`} />
            <span className={labelClass}>{t(phase)}</span>
            {idx < PHASES.length - 1 && (
              <span className="text-neutral-700 mx-0.5">·</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
