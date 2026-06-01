// Expand-phase real-world effects: FILE_WRITE blocks and TOOL_RUN markers.
//
// The Expand phase model embeds these in its output. The loop driver extracts
// them, validates paths against a writable-subtree allowlist, applies the
// writes, optionally runs the named tools sandboxed, and replaces the raw
// blocks with a summary in the episodic file.

import * as path from "node:path";

import { writeAtomic } from "../../persistence/fs.ts";
import { runSandboxed, type NetworkAccess } from "./sandbox.ts";

const FW_OPEN = "<!-- FILE_WRITE:";
const MARKER_CLOSE = "-->";
const FW_END = "<!-- END_FILE_WRITE -->";
const TR_OPEN = "<!-- TOOL_RUN:";
const INTENT_OPEN = "<!-- INTENT -->";
const INTENT_END = "<!-- END_INTENT -->";

/**
 * The Expand phase may write anywhere inside the instance EXCEPT the protected
 * SP-I core. This denylist honours "endogene Korpus-Erweiterung". What it must
 * never touch:
 */
const PROTECTED_EXACT: string[] = [
  "corpus/identity.md", // SP-I.1
  "corpus/state.md", // managed by the integrate phase
  "CLAUDE.md", // the constitution
  ".orbis-meta.json", // app metadata
];

/**
 * Protected subtrees — episodic/genesis are append-only loop history, loop/* is
 * the metabolism itself, superinstance + stimuli are managed by the loop
 * machinery, .git is the version store.
 */
const PROTECTED_PREFIXES: string[] = [
  "corpus/episodic/", // SP-I.4 append-only
  "corpus/genesis/", // meta-history, immutable except append
  "loop/", // SP-I.2
  "superinstance/", // reconstituted by the loop, not by Expand
  "stimuli/", // managed by the stimulus flow + integrate
  ".git/",
];

const KNOWLEDGE_PREFIX = "corpus/knowledge/";
const KNOWLEDGE_MAX_BYTES = 100 * 1024;

/**
 * Phase 15: a single carve-out from the otherwise blanket `stimuli/`
 * protection. `stimuli/outbox/` is the organism's outbound channel.
 */
const WRITABLE_EXCEPTIONS: string[] = ["stimuli/outbox/"];
const OUTBOX_PREFIX = "stimuli/outbox/";
const OUTBOX_MAX_BYTES = 100 * 1024;

export interface FileWrite {
  relpath: string;
  content: string;
}

/** Extract FILE_WRITE blocks. Returns the blocks and the text with them removed. */
export function extractFileWrites(
  text: string,
): { writes: FileWrite[]; rest: string } {
  const blocks: FileWrite[] = [];
  let kept = "";
  let rest = text;

  for (;;) {
    const openIdx = rest.indexOf(FW_OPEN);
    if (openIdx === -1) {
      kept += rest;
      break;
    }
    kept += rest.slice(0, openIdx);
    const afterOpen = rest.slice(openIdx + FW_OPEN.length);

    const markerEnd = afterOpen.indexOf(MARKER_CLOSE);
    if (markerEnd === -1) {
      kept += rest.slice(openIdx);
      break;
    }
    const relpath = afterOpen.slice(0, markerEnd).trim();
    const afterMarker = afterOpen.slice(markerEnd + MARKER_CLOSE.length);

    const closeIdx = afterMarker.indexOf(FW_END);
    if (closeIdx === -1) {
      kept += rest.slice(openIdx);
      break;
    }
    const content = stripWrapperTags(
      trimMatchesNewline(afterMarker.slice(0, closeIdx)),
    );
    blocks.push({ relpath, content });
    rest = afterMarker.slice(closeIdx + FW_END.length);
  }

  return { writes: blocks, rest: kept };
}

/**
 * Strip leading/trailing lines that are bare XML wrapper tags. Some models
 * wrap emitted content in `<string>…</string>`; the closing tag leaks into
 * FILE_WRITE blocks and breaks the written file's syntax.
 */
function stripWrapperTags(s: string): string {
  const isWrapper = (line: string): boolean => {
    const t = line.trim();
    return t === "<string>" || t === "</string>";
  };
  const lines = s.split("\n");
  while (lines.length > 0 && isWrapper(lines[0])) lines.shift();
  while (lines.length > 0 && isWrapper(lines[lines.length - 1])) lines.pop();
  return lines.join("\n");
}

/**
 * Extract single-line TOOL_RUN markers. Returns the tool paths and the text
 * with the markers removed.
 */
export function extractToolRuns(text: string): { tools: string[]; rest: string } {
  const tools: string[] = [];
  let kept = "";
  let rest = text;

  for (;;) {
    const openIdx = rest.indexOf(TR_OPEN);
    if (openIdx === -1) {
      kept += rest;
      break;
    }
    kept += rest.slice(0, openIdx);
    const afterOpen = rest.slice(openIdx + TR_OPEN.length);
    const markerEnd = afterOpen.indexOf(MARKER_CLOSE);
    if (markerEnd === -1) {
      kept += rest.slice(openIdx);
      break;
    }
    tools.push(afterOpen.slice(0, markerEnd).trim());
    rest = afterOpen.slice(markerEnd + MARKER_CLOSE.length);
  }

  return { tools, rest: kept };
}

/**
 * Extract the model's `<!-- INTENT --> … <!-- END_INTENT -->` block — its
 * forward-looking plan for the loop. `null` if absent or empty.
 */
export function extractIntent(text: string): string | null {
  const open = text.indexOf(INTENT_OPEN);
  if (open === -1) return null;
  const after = text.slice(open + INTENT_OPEN.length);
  const close = after.indexOf(INTENT_END);
  if (close === -1) return null;
  const intent = after.slice(0, close).trim();
  return intent.length === 0 ? null : intent;
}

/** Returns a rejection reason, or `null` if the write path is allowed. */
export function validateWritePath(relpath: string): string | null {
  if (relpath.length === 0) {
    return "empty path";
  }
  if (relpath.includes("..")) {
    return "path contains '..'";
  }
  if (relpath.startsWith("/")) {
    return "absolute paths not allowed";
  }
  if (PROTECTED_EXACT.includes(relpath)) {
    return `'${relpath}' is protected (SP-I core)`;
  }
  // Carve-outs win over the prefix protection.
  if (WRITABLE_EXCEPTIONS.some((p) => relpath.startsWith(p))) {
    return null;
  }
  const protectedPrefix = PROTECTED_PREFIXES.find((p) => relpath.startsWith(p));
  if (protectedPrefix !== undefined) {
    return `'${relpath}' is in a protected subtree (${protectedPrefix})`;
  }
  return null;
}

/** Returns a rejection reason, or `null` if the tool path is allowed. */
export function validateToolPath(relpath: string): string | null {
  if (relpath.includes("..") || relpath.startsWith("/")) {
    return "illegal tool path";
  }
  if (
    !relpath.startsWith("tools/native/") &&
    !relpath.startsWith("tools/external/")
  ) {
    return "tools must live under tools/native/ or tools/external/";
  }
  return null;
}

export interface WriteOutcome {
  written: string[];
  rejected: [string, string][];
}

export function applyWrites(
  instanceRoot: string,
  writes: FileWrite[],
): WriteOutcome {
  const written: string[] = [];
  const rejected: [string, string][] = [];

  for (const b of writes) {
    const reason = validateWritePath(b.relpath);
    if (reason !== null) {
      rejected.push([b.relpath, reason]);
      continue;
    }
    const byteLen = Buffer.byteLength(b.content, "utf8");
    if (b.relpath.startsWith(KNOWLEDGE_PREFIX) && byteLen > KNOWLEDGE_MAX_BYTES) {
      rejected.push([
        b.relpath,
        `exceeds SC-003 knowledge cap: ${byteLen} bytes > 100 KB`,
      ]);
      continue;
    }
    if (b.relpath.startsWith(OUTBOX_PREFIX) && byteLen > OUTBOX_MAX_BYTES) {
      rejected.push([b.relpath, `exceeds outbox cap: ${byteLen} bytes > 100 KB`]);
      continue;
    }
    const full = path.join(instanceRoot, b.relpath);
    try {
      writeAtomic(full, b.content);
      written.push(b.relpath);
    } catch (e: any) {
      rejected.push([b.relpath, String(e?.message ?? e)]);
    }
  }

  return { written, rejected };
}

/**
 * Process the raw Expand output and compose the episodic body.
 *
 * Confabulation-proof by construction: the model contributes only the INTENT
 * block and the action blocks (FILE_WRITE / TOOL_RUN). Every other word of free
 * model prose is discarded. The episodic is then composed by code — Intent +
 * the *factual* outcomes of the writes and runs — so it can never claim
 * something the filesystem contradicts.
 */
export async function processExpand(
  rawBody: string,
  allowToolExecution: boolean,
  networkPolicy: NetworkAccess,
  allowlist: string[],
  instanceRoot: string,
): Promise<string> {
  const { writes } = extractFileWrites(rawBody);
  const { tools } = extractToolRuns(rawBody);
  const intent = extractIntent(rawBody);

  const outcome = applyWrites(instanceRoot, writes);

  let out = "";

  out += "## Intent\n";
  if (intent !== null) {
    out += intent.trim();
    out += "\n";
  } else {
    out += "_(model emitted no INTENT block)_\n";
  }

  out += "\n## Applied file writes\n";
  if (outcome.written.length === 0 && outcome.rejected.length === 0) {
    out += "_(no FILE_WRITE blocks in this expand)_\n";
  } else {
    for (const w of outcome.written) {
      out += `- wrote \`${w}\`\n`;
    }
    for (const [p, r] of outcome.rejected) {
      out += `- REJECTED \`${p}\` — ${r}\n`;
    }
  }

  out += "\n## Tool run results\n";
  out += `_network policy this expand: ${networkPolicy}_\n`;
  if (tools.length === 0) {
    out += "_(no TOOL_RUN markers in this expand)_\n";
  } else {
    for (const tool of tools) {
      const reason = validateToolPath(tool);
      if (reason !== null) {
        out += `- \`${tool}\` — REJECTED: ${reason}\n`;
        continue;
      }
      if (!allowToolExecution) {
        out += `- \`${tool}\` — skipped (tool execution disabled in Settings)\n`;
        continue;
      }
      try {
        const res = await runSandboxed(
          instanceRoot,
          tool,
          networkPolicy,
          allowlist,
        );
        const timed = res.timedOut ? " (TIMED OUT)" : "";
        out += `- \`${tool}\` — exit ${formatExit(res.exitCode)}${timed}\n\n\`\`\`\nstdout:\n${res.stdout}\n\nstderr:\n${res.stderr}\n\`\`\`\n`;
      } catch (e: any) {
        out += `- \`${tool}\` — execution error: ${appErrorDisplay(e)}\n`;
      }
    }
  }

  return out;
}

/** Format an exit code as `Some(N)` or `None`. */
function formatExit(code: number | null): string {
  return code === null ? "None" : `Some(${code})`;
}

/** Render an error using `AppError`'s display string when available. */
function appErrorDisplay(e: unknown): string {
  if (e && typeof (e as any).toDisplay === "function") {
    return (e as any).toDisplay();
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Strip leading/trailing newlines only. */
function trimMatchesNewline(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === "\n") start++;
  while (end > start && s[end - 1] === "\n") end--;
  return s.slice(start, end);
}
