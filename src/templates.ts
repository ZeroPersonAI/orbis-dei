// Bootstrap templates. They are read once from assets/templates at startup and
// the strings are cached.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const TPL = path.resolve(here, "..", "assets", "templates");

const read = (rel: string): string => fs.readFileSync(path.join(TPL, rel), "utf8");

export const CLAUDE_MD = read("CLAUDE.md");
export const IDENTITY_MD = read("identity.md");
export const STATE_MD = read("state.md");
export const SUPERINSTANCE_MD = read("superinstance.md");

export function renderStateMd(createdAt: string): string {
  return STATE_MD.replace("{{created_at}}", createdAt);
}

/** [filename, contents] for the seven standing concerns written at bootstrap. */
export function standingConcerns(): [string, string][] {
  const names = [
    "sc-001-phasen-disziplin.md",
    "sc-002-state-aktualitaet.md",
    "sc-003-knowledge-budget.md",
    "sc-004-election-diversitaet.md",
    "sc-005-tool-diversitaet.md",
    "sc-006-stimuli-pflicht.md",
    "sc-007-boredom-detection.md",
  ];
  return names.map((n) => [n, read(path.join("standing", n))]);
}

/** [filename, contents] for the six loop-phase templates. */
export function loopPhases(): [string, string][] {
  const names = ["observe.md", "diverge.md", "elect.md", "expand.md", "review.md", "integrate.md"];
  return names.map((n) => [n, read(path.join("loop", n))]);
}

const PHASE_TEMPLATE: Record<string, string> = Object.fromEntries(
  loopPhases().map(([n, c]) => [n.replace(/\.md$/, ""), c]),
);

/** System prompt for a phase = its loop/<phase>.md template. */
export function phaseTemplate(phase: string): string {
  return PHASE_TEMPLATE[phase] ?? "";
}
