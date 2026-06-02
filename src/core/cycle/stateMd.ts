// state.md counter/phase mutation and the integrate-phase narrative
// split/rebuild logic.

import * as fs from "node:fs";

import { writeAtomic } from "../../persistence/fs.ts";
import { AppError } from "../../error.ts";

export const STATE_NARRATIVE_OPEN = "<!-- STATE_NARRATIVE_START -->";
export const STATE_NARRATIVE_CLOSE = "<!-- STATE_NARRATIVE_END -->";

/** Read `Loop-Counter: N` line from `state.md`. Returns N. */
export function readCounter(statePath: string): number {
  let content: string;
  try {
    content = fs.readFileSync(statePath, "utf8");
  } catch (e: any) {
    throw new AppError(
      "internal",
      `could not read state.md at ${statePath}: ${e?.message ?? e}`,
    );
  }
  const re = /^[\-\*\s]*Loop-Counter\s*:\s*(\d+)/m;
  const m = re.exec(content);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n)) return n;
  }
  throw new AppError(
    "internal",
    "state.md missing `Loop-Counter: <N>` line — cannot derive canonical counter",
  );
}

/**
 * Apply integrate-side state.md updates:
 * - bump Loop-Counter to `newCounter`
 * - set the `Last phase` line to `integrate`
 * - append a Last integrate timestamp line (or update if present)
 */
export function applyIntegrate(
  statePath: string,
  newCounter: number,
  nowRfc: string,
): void {
  const original = readOrDefault(statePath);

  let content = bumpCounter(original, newCounter);
  content = setLastPhase(content, "integrate");
  content = upsertLastIntegrate(content, nowRfc);

  writeAtomic(statePath, content);
}

function readOrDefault(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function bumpCounter(content: string, newCounter: number): string {
  const re = /^([\-\*\s]*Loop-Counter\s*:\s*)\d+/m;
  return content.replace(re, (_full, p1: string) => `${p1}${newCounter}`);
}

function setLastPhase(content: string, value: string): string {
  const re = /^([\-\*\s]*Last phase\s*:\s*).*$/im;
  if (re.test(content)) {
    return content.replace(re, (_full, p1: string) => `${p1}${value}`);
  }
  // append a marker if the template was edited away
  return `${trimEnd(content)}\n- Last phase: ${value}\n`;
}

function upsertLastIntegrate(content: string, nowRfc: string): string {
  const re = /^([\-\*\s]*Last integrate\s*:\s*).*$/im;
  if (re.test(content)) {
    return content.replace(re, (_full, p1: string) => `${p1}${nowRfc}`);
  }
  return `${trimEnd(content)}\n- Last integrate: ${nowRfc}\n`;
}

/**
 * Split an integrate-phase output into (optional narrative, cleaned-up final.md body).
 *
 * If the model wrapped a STATE_NARRATIVE block, returns the inner narrative and
 * the remaining text with the block stripped out. If not, the narrative is null
 * and the body is returned as-is (caller falls back to mechanical state.md update).
 */
export function splitIntegrateOutput(
  body: string,
): { narrative: string | null; cleaned: string } {
  const trimmed = body.trim();
  const openIdx = trimmed.indexOf(STATE_NARRATIVE_OPEN);
  if (openIdx !== -1) {
    const afterOpen = openIdx + STATE_NARRATIVE_OPEN.length;
    const closeOffset = trimmed.slice(afterOpen).indexOf(STATE_NARRATIVE_CLOSE);
    if (closeOffset !== -1) {
      const closeIdx = afterOpen + closeOffset;
      const narrative = trimmed.slice(afterOpen, closeIdx).trim();
      const before = trimEnd(trimmed.slice(0, openIdx));
      const after = trimStart(
        trimmed.slice(closeIdx + STATE_NARRATIVE_CLOSE.length),
      );
      let finalMd: string;
      if (before.length === 0) {
        finalMd = after;
      } else if (after.length === 0) {
        finalMd = before;
      } else {
        finalMd = `${before}\n\n${after}`;
      }
      return {
        narrative: narrative.length === 0 ? null : narrative,
        cleaned: finalMd.trim(),
      };
    }
  }
  return { narrative: null, cleaned: trimmed };
}

/**
 * Rebuild state.md with a fresh mechanical header and a model-supplied narrative.
 * Preserves the Born and Host fields from the existing state.md.
 */
export function rebuildWithNarrative(
  statePath: string,
  newCounter: number,
  nowRfc: string,
  narrative: string,
): void {
  const current = readOrDefault(statePath);
  const born = extractField(current, "Born") ?? nowRfc;
  const host = extractField(current, "Host") ?? "Orbis Dei Habitat";

  const content =
    `# State — Loop ${newCounter}\n` +
    `\n` +
    `## Identification\n` +
    `- Loop-Counter: ${newCounter}\n` +
    `- Born: ${born}\n` +
    `- Last phase: integrate\n` +
    `- Last integrate: ${nowRfc}\n` +
    `- Host: ${host}\n` +
    `\n` +
    `${narrative.trim()}\n`;
  writeAtomic(statePath, content);
}

/** Extract `FIELD: <value>` from a markdown-ish list/heading line. */
export function extractField(content: string, field: string): string | null {
  const pat = `^[\\-\\*\\s]*${escapeRegex(field)}\\s*:\\s*(.+)$`;
  let re: RegExp;
  try {
    re = new RegExp(pat, "m");
  } catch {
    return null;
  }
  const m = re.exec(content);
  if (m && m[1] != null) return m[1].trim();
  return null;
}

// --- string helpers for trim_end / trim_start semantics ---

function trimEnd(s: string): string {
  return s.replace(/\s+$/, "");
}

function trimStart(s: string): string {
  return s.replace(/^\s+/, "");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
