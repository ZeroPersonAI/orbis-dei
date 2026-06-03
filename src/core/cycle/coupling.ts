// Per-instance coupling level. A single selectable knob that collapses the two
// independent loop controls (network policy + tool execution) into a ladder of
// how strongly an organism is coupled to the world:
//
//   mirror — closed/solipsistic: no network, no tool execution. The loop only
//            metabolizes its own corpus + operator stimuli (a pure mirror that
//            plays its assumptions forward).
//   gated  — supervised coupling: tools run, network limited to the allowlisted
//            hosts (TCP 80/443).
//   open   — full coupling: tools run, raw network access (red-warned each loop).
//
// The underlying enforcement (sandbox, allowlist, the "open" warning, non-macOS
// refusal, invariants) is unchanged — the level is just the preset in front.
import type { NetworkAccess } from "./sandbox.ts";

export type CouplingLevel = "mirror" | "gated" | "open";

export const COUPLING_LEVELS: CouplingLevel[] = ["mirror", "gated", "open"];
export const DEFAULT_COUPLING: CouplingLevel = "mirror";

/** Coerce arbitrary input to a valid level, defaulting to the safe (closed) one. */
export function normalizeCoupling(s: string | null | undefined): CouplingLevel {
  return s && (COUPLING_LEVELS as string[]).includes(s) ? (s as CouplingLevel) : DEFAULT_COUPLING;
}

/** Effective network policy + tool execution for a loop at the given level. */
export function couplingPolicy(level: CouplingLevel): {
  networkPolicy: NetworkAccess;
  allowToolExecution: boolean;
} {
  switch (level) {
    case "open":
      return { networkPolicy: "open", allowToolExecution: true };
    case "gated":
      return { networkPolicy: "gated", allowToolExecution: true };
    case "mirror":
    default:
      return { networkPolicy: "off", allowToolExecution: false };
  }
}
