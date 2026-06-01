// Parse historical `loop-NNNNN-expand.md` files into structured records.
//
// Phase 12 and 13 both need to inspect what the Expand phase actually did per
// loop: which tools ran, what their exit codes were, what network policy was in
// force. The composer of those files is `expandIo.ts`, so the shape parsed here
// mirrors what that module writes.

import * as fs from "node:fs";
import * as path from "node:path";

const NETWORK_MARKER = "_network policy this expand:";

export interface ToolRunRow {
  tool: string;
  /** `0`, a non-zero number, or `null` for REJECTED/skipped/error/timeout. */
  exitCode: number | null;
  /**
   * First chunk of the tool's stdout+stderr block, or a short note line
   * (e.g. "REJECTED: …", "skipped (tool execution disabled in Settings)").
   */
  outputExcerpt: string;
  /** True for terminal-failed runs (non-zero exit) so the UI can color them. */
  failed: boolean;
}

export interface ExpandReport {
  loopN: number;
  /** `"off"` for loops that pre-date Phase 12 *or* explicitly off. */
  networkPolicy: string;
  toolRuns: ToolRunRow[];
}

/**
 * Parse a single `loop-NNNNN-expand.md` file. Returns `null` if it cannot be
 * read; never throws on malformed content.
 */
export function parseExpandFile(
  filePath: string,
  loopN: number,
): ExpandReport | null {
  let body: string;
  try {
    body = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  const policy = extractNetworkPolicy(body) ?? "off";
  const toolRuns = parseToolRuns(body);
  return { loopN, networkPolicy: policy, toolRuns };
}

/** Walk the episodic dir; return up to `max` reports newest-first. */
export function walkRecentExpands(
  episodicDir: string,
  max: number,
): ExpandReport[] {
  const files = listExpandFiles(episodicDir);
  files.sort((a, b) => b[0] - a[0]);
  const truncated = files.slice(0, max);
  const out: ExpandReport[] = [];
  for (const [n, p] of truncated) {
    const r = parseExpandFile(p, n);
    if (r !== null) out.push(r);
  }
  return out;
}

function listExpandFiles(dir: string): [number, string][] {
  const out: [number, string][] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return out;
  }
  const prefix = "loop-";
  const suffix = "-expand.md";
  for (const name of entries) {
    if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
    const mid = name.slice(prefix.length, name.length - suffix.length);
    const n = parseIntStrict(mid);
    if (n !== null) out.push([n, path.join(dir, name)]);
  }
  return out;
}

function extractNetworkPolicy(body: string): string | null {
  for (const line of body.split("\n")) {
    const l = line.trim();
    if (l.startsWith(NETWORK_MARKER)) {
      const rest = l.slice(NETWORK_MARKER.length);
      // rest.trim().trim_end_matches('_').trim()
      return trimEndMatches(rest.trim(), "_").trim();
    }
  }
  return null;
}

/**
 * Scan the lines after "## Tool run results" and pick out every
 * `- \`tools/native/…\` — exit Some(N)` (or REJECTED / skipped / error) entry,
 * together with the leading chunk of the code block following it.
 */
function parseToolRuns(body: string): ToolRunRow[] {
  const sectionStart = body.indexOf("## Tool run results");
  if (sectionStart === -1) return [];
  const section = body.slice(sectionStart);

  const runs: ToolRunRow[] = [];
  const lines = section.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Headline of a tool entry: `- \`PATH\` — REST`
    const headline = parseToolHeadline(line);
    if (headline !== null) {
      const [tool, rest] = headline;
      // Try to capture an output excerpt from the immediately following
      // ```...``` fence (only present for actually-executed runs).
      let excerpt = "";
      let j = i + 1;
      // Skip blank lines.
      while (j < lines.length && lines[j].trim().length === 0) j++;
      if (j < lines.length && trimStart(lines[j]).startsWith("```")) {
        j++;
        while (j < lines.length && !trimStart(lines[j]).startsWith("```")) {
          excerpt += lines[j];
          excerpt += "\n";
          if (excerpt.length > 600) {
            excerpt += "…[truncated]";
            break;
          }
          j++;
        }
      } else {
        // No code block — the headline itself carries the note (rejection / skip / error).
        excerpt = rest;
      }

      const [exitCode, failed] = parseExit(rest);
      runs.push({
        tool,
        exitCode,
        outputExcerpt: trimEnd(excerpt),
        failed,
      });
    }
    i += 1;
  }
  return runs;
}

function parseToolHeadline(line: string): [string, string] | null {
  const l = trimStart(line);
  if (!l.startsWith("- `")) return null;
  const rest = l.slice("- `".length);
  const close = rest.indexOf("`");
  if (close === -1) return null;
  const tool = rest.slice(0, close);
  // trim_start_matches([' ', '—', '-']) then trim()
  const after = trimStartMatchesChars(rest.slice(close + 1), [" ", "—", "-"]).trim();
  if (!tool.startsWith("tools/native/") && !tool.startsWith("tools/external/")) {
    return null;
  }
  return [tool, after];
}

/**
 * Extract exit code from "exit Some(N)" / "exit None" patterns, and decide
 * whether the run failed (non-zero exit, rejection, timeout, error).
 */
function parseExit(rest: string): [number | null, boolean] {
  const start = rest.indexOf("exit Some(");
  if (start !== -1) {
    const after = rest.slice(start + "exit Some(".length);
    const close = after.indexOf(")");
    if (close !== -1) {
      const code = parseIntStrict(after.slice(0, close));
      if (code !== null) {
        const timedOut = rest.includes("TIMED OUT");
        return [code, code !== 0 || timedOut];
      }
    }
  }
  if (
    rest.includes("REJECTED") ||
    rest.includes("execution error") ||
    rest.includes("TIMED OUT") ||
    rest.includes("skipped")
  ) {
    return [null, true];
  }
  return [null, false];
}

// --- string helpers ---

function trimStart(s: string): string {
  return s.replace(/^\s+/, "");
}

function trimEnd(s: string): string {
  return s.replace(/\s+$/, "");
}

/** Strip every trailing occurrence of `c`. */
function trimEndMatches(s: string, c: string): string {
  let end = s.length;
  while (end > 0 && s[end - 1] === c) end--;
  return s.slice(0, end);
}

/** Strip leading chars in `set`. */
function trimStartMatchesChars(s: string, set: string[]): string {
  let start = 0;
  while (start < s.length && set.includes(s[start])) start++;
  return s.slice(start);
}

/** Parse strictly: the whole string must be an integer. */
function parseIntStrict(s: string): number | null {
  if (!/^[+-]?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}
