// Bootstrap templates, per organism language. Each language has a full set
// under assets/templates/<lang>/. Files are read on demand and cached. An
// instance is born in one language (chosen at creation) and keeps it.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type Lang = "en" | "de" | "zh" | "es" | "fr";
export const LANGS: Lang[] = ["en", "de", "zh", "es", "fr"];
export const DEFAULT_LANG: Lang = "en";

export function normalizeLang(s: string | null | undefined): Lang {
  return s && (LANGS as string[]).includes(s) ? (s as Lang) : DEFAULT_LANG;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const TPL = path.resolve(here, "..", "assets", "templates");

const cache = new Map<string, string>();

/** Read a template for a language, falling back to en then de. */
function read(lang: Lang, rel: string): string {
  const key = `${lang}/${rel}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let content = "";
  for (const l of [lang, "en", "de"] as Lang[]) {
    const p = path.join(TPL, l, rel);
    try {
      content = fs.readFileSync(p, "utf8");
      break;
    } catch {
      /* try next fallback */
    }
  }
  cache.set(key, content);
  return content;
}

export const claudeMd = (lang: Lang): string => read(lang, "CLAUDE.md");
export const identityMd = (lang: Lang): string => read(lang, "identity.md");
export const superinstanceMd = (lang: Lang): string => read(lang, "superinstance.md");

export function renderStateMd(createdAt: string, lang: Lang): string {
  return read(lang, "state.md").replace("{{created_at}}", createdAt);
}

const STANDING = [
  "sc-001-phasen-disziplin.md",
  "sc-002-state-aktualitaet.md",
  "sc-003-knowledge-budget.md",
  "sc-004-election-diversitaet.md",
  "sc-005-tool-diversitaet.md",
  "sc-006-stimuli-pflicht.md",
  "sc-007-boredom-detection.md",
];

/** [filename, contents] for the seven standing concerns written at bootstrap. */
export function standingConcerns(lang: Lang): [string, string][] {
  return STANDING.map((n) => [n, read(lang, path.join("standing", n))]);
}

const LOOP_FILES = ["observe.md", "diverge.md", "elect.md", "expand.md", "review.md", "integrate.md"];

/** [filename, contents] for the six loop-phase templates. */
export function loopPhases(lang: Lang): [string, string][] {
  return LOOP_FILES.map((n) => [n, read(lang, path.join("loop", n))]);
}

/** System prompt for a phase = its loop/<phase>.md template in the instance's language. */
export function phaseTemplate(phase: string, lang: Lang): string {
  return read(lang, path.join("loop", `${phase}.md`));
}
