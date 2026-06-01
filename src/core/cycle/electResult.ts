// Phase 8 elect-phase drift detection.
//
// The elect template asks the model to append a trailing marker
// `<!-- ELECT_RESULT: accepted=N, rejected=M -->` so the app can track SC-004
// election diversity (rejections mandatory, 20 unanimous in a row triggers a
// Filter-Versagen warning + RSI diagnosis hint).
//
// `computeUnanimousStreak` walks the most recent elect files backwards: an
// election with `rejected > 0` ends the streak; a missing or malformed marker
// also ends it (conservative — we never claim unanimity we cannot verify), and
// is counted separately so the UI can flag when drift detection itself is
// degraded.

import * as fs from "node:fs";
import * as path from "node:path";

export interface ElectResult {
  accepted: number;
  rejected: number;
}

export interface DriftStreak {
  unanimousStreak: number;
  markersMissingInWindow: number;
  window: number;
}

const ELECT_MARKER_PREFIX = "<!-- ELECT_RESULT:";

/** Parse the trailing ELECT_RESULT marker. `null` if absent or malformed. */
export function parseElectResult(text: string): ElectResult | null {
  // Find the LAST line that starts with the marker prefix (after trim_start).
  const lines = text.split("\n");
  let line: string | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (trimStart(lines[i]).startsWith(ELECT_MARKER_PREFIX)) {
      line = lines[i];
      break;
    }
  }
  if (line === null) return null;

  const accepted = extractU32(line, "accepted");
  if (accepted === null) return null;
  const rejected = extractU32(line, "rejected");
  if (rejected === null) return null;
  return { accepted, rejected };
}

function extractU32(line: string, key: string): number | null {
  const needle = `${key}=`;
  const idx = line.indexOf(needle);
  if (idx === -1) return null;
  const rest = line.slice(idx + needle.length);
  // Take the leading run of ascii digits.
  let end = 0;
  while (end < rest.length && rest[end] >= "0" && rest[end] <= "9") end++;
  if (end === 0) return null; // no digits → not a valid count
  const digits = rest.slice(0, end);
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return null;
  return n;
}

/**
 * Walk the latest `window` elect episodic files. An election with
 * `rejected > 0` or a missing marker breaks the streak (conservative).
 */
export function computeUnanimousStreak(
  episodicDir: string,
  window: number,
): DriftStreak {
  const entries = listElectFiles(episodicDir);
  entries.sort((a, b) => b[0] - a[0]); // newest loop first

  let streak = 0;
  let missing = 0;
  let streakActive = true;

  for (const [, filePath] of entries.slice(0, window)) {
    const body = readOrDefault(filePath);
    const r = parseElectResult(body);
    if (r !== null && r.rejected === 0) {
      if (streakActive) {
        streak += 1;
      }
    } else if (r !== null) {
      streakActive = false;
    } else {
      missing += 1;
      streakActive = false;
    }
  }

  return {
    unanimousStreak: streak,
    markersMissingInWindow: missing,
    window,
  };
}

function listElectFiles(episodicDir: string): [number, string][] {
  const out: [number, string][] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(episodicDir);
  } catch {
    return out;
  }
  const prefix = "loop-";
  const suffix = "-elect.md";
  for (const name of entries) {
    // loop-NNNNN-elect.md
    if (!name.endsWith(suffix) || !name.startsWith(prefix)) continue;
    const mid = name.slice(prefix.length, name.length - suffix.length);
    const n = parseIntStrict(mid);
    if (n !== null) {
      out.push([n, path.join(episodicDir, name)]);
    }
  }
  return out;
}

function readOrDefault(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/** Parse strictly: the full string must be a valid integer. */
function parseIntStrict(s: string): number | null {
  if (!/^[+-]?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function trimStart(s: string): string {
  return s.replace(/^\s+/, "");
}
