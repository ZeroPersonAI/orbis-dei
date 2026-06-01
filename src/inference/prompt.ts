// Builds the split prompt (system / stableUser / dynamicUser) for a phase from
// the instance's on-disk
// corpus. Marker strings and section headers are reproduced verbatim because
// the Expand/Elect/Review/Integrate parsers depend on them.
import * as fs from "node:fs";
import * as path from "node:path";
import { InstancePaths } from "../persistence/fs.ts";
import { phaseTemplate } from "../templates.ts";
import type { Phase } from "./index.ts";
import type { PromptParts } from "./router.ts";

function readOrPlaceholder(p: string, fallback: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return fallback;
  }
}

/** [name, body] for non-dotfile regular files, sorted by name ascending. */
function listDirContents(dir: string): [string, string][] {
  if (!fs.existsSync(dir)) return [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: [string, string][] = [];
  names
    .filter((n) => !n.startsWith("."))
    .filter((n) => {
      try {
        return fs.statSync(path.join(dir, n)).isFile();
      } catch {
        return false;
      }
    })
    .sort()
    .forEach((n) => {
      let body = "";
      try {
        body = fs.readFileSync(path.join(dir, n), "utf8");
      } catch {
        body = "";
      }
      out.push([n, body]);
    });
  return out;
}

/** Last `max` episodic .md files in ascending (oldest→newest) order. */
function recentEpisodic(episodicDir: string, max: number): [string, string][] {
  if (!fs.existsSync(episodicDir)) return [];
  let names: string[];
  try {
    names = fs.readdirSync(episodicDir).filter((n) => n.toLowerCase().endsWith(".md"));
  } catch {
    return [];
  }
  names.sort();
  const tail = names.slice(Math.max(0, names.length - max));
  return tail.map((n) => {
    let body = "";
    try {
      body = fs.readFileSync(path.join(episodicDir, n), "utf8");
    } catch {
      body = "";
    }
    return [n, body] as [string, string];
  });
}

function buildStableUser(paths: InstancePaths): string {
  let out = "";
  out += "## Identity (corpus/identity.md, read-only)\n\n```markdown\n";
  out += readOrPlaceholder(paths.identity(), "(identity.md missing)");
  out += "\n```\n\n";
  out += "## Standing concerns (stimuli/standing/, persistent rules)\n\n";
  for (const [name, body] of listDirContents(paths.stimuliStanding())) {
    out += `### ${name}\n\n\`\`\`markdown\n${body}\n\`\`\`\n\n`;
  }
  return out;
}

function buildDynamicUser(paths: InstancePaths, phase: Phase, loopN: number): string {
  let out = "";
  out += `# Current loop\nLoop counter (canonical from state.md): ${loopN}\nPhase: ${phase}\n\n`;
  out += "## Current self-state (corpus/state.md)\n\n```markdown\n";
  out += readOrPlaceholder(paths.state(), "(state.md missing)");
  out += "\n```\n\n";

  out += "## Recent episodic memory (last loop, if any)\n\n";
  const recent = recentEpisodic(paths.episodic(), 6);
  if (recent.length === 0) {
    out += "_(no prior episodic files)_\n\n";
  } else {
    for (const [name, body] of recent) {
      out += `### ${name}\n\n\`\`\`markdown\n${body}\n\`\`\`\n\n`;
    }
  }

  out += "## Stimuli — inbox (unprocessed)\n\n";
  const inbox = listDirContents(paths.stimuliInbox());
  if (inbox.length === 0) {
    out += "_(inbox empty — note this explicitly per SC-006/SC-007)_\n\n";
  } else {
    for (const [name, body] of inbox) {
      out += `### ${name}\n\n\`\`\`\n${body}\n\`\`\`\n\n`;
    }
  }

  out += phaseUserSuffix(phase, loopN);
  return out;
}

function pad5(n: number): string {
  return String(n).padStart(5, "0");
}

function phaseUserSuffix(phase: Phase, loopN: number): string {
  const base =
    `## Task — write your phase output for loop ${pad5(loopN)}\n\n` +
    `Output ONLY the markdown body that should be saved to ` +
    `\`corpus/episodic/loop-${pad5(loopN)}-${phase}.md\`. ` +
    `No code fences around the whole thing, no "here is the file:" preamble — just the markdown.\n\n`;

  let phaseSpecific = "";
  switch (phase) {
    case "expand":
      phaseSpecific =
        "Your output for this phase has a STRICT structure — three kinds of " +
        "content, everything else is discarded:\n" +
        "\n" +
        "1. One INTENT block — your forward-looking plan for this loop " +
        "(an intention, NOT a claim about what is already done):\n" +
        "<!-- INTENT -->\n" +
        "This loop applies Elect decisions K1–K3: <concrete, several lines>\n" +
        "<!-- END_INTENT -->\n" +
        "\n" +
        "2. FILE_WRITE blocks — content written verbatim to disk. Replace the " +
        "placeholder path with a real one:\n" +
        "<!-- FILE_WRITE: <relative-path> -->\n" +
        "<file content, verbatim>\n" +
        "<!-- END_FILE_WRITE -->\n" +
        "Writable anywhere in the instance EXCEPT the protected core " +
        "(corpus/identity.md, corpus/state.md, loop/*, corpus/episodic/*, " +
        "corpus/genesis/*, superinstance/*, stimuli/* — except " +
        "`stimuli/outbox/` which is YOUR outbound channel to the " +
        "operator —, CLAUDE.md, paths with `..`). No knowledge file or " +
        "outbox file over 100 KB. Tool scripts start with a shebang.\n" +
        "\n" +
        "3. TOOL_RUN markers — run a tool you wrote THIS loop:\n" +
        "<!-- TOOL_RUN: <path-to-the-tool> -->\n" +
        "It runs sandboxed (no network, writes confined to the instance, 30s).\n" +
        "\n" +
        "DO NOT write a narrative of what you accomplished. You cannot know " +
        "the outcomes of your FILE_WRITE / TOOL_RUN actions at output time — " +
        "the app applies them afterwards. Any \"I fixed X\" claim would be a " +
        "blind guess. The app composes this episodic file factually from your " +
        "INTENT block plus the real \"Applied file writes\" and \"Tool run " +
        "results\". Prose outside INTENT / FILE_WRITE / TOOL_RUN is discarded. " +
        "If you decide something, carry it out with a real block — what is " +
        "not in a block does not happen.\n";
      break;
    case "elect":
      phaseSpecific =
        "End your output with a single trailing marker on its own line, " +
        "exactly in this format:\n" +
        "\n" +
        "<!-- ELECT_RESULT: accepted=<N>, rejected=<M> -->\n" +
        "\n" +
        "where N and M are the integer counts of accepted and rejected " +
        "candidates in this election. SC-004 requires at least one rejection " +
        "per election; the marker lets the app track the unanimous-streak " +
        "mechanically.\n";
      break;
    case "review":
      phaseSpecific =
        "Begin your output with a single line that is exactly `PASS` or `FAIL` " +
        "(uppercase, no other characters on that line), then a blank line, " +
        "then your detailed pass/fail reasoning per check.\n";
      break;
    case "integrate":
      phaseSpecific =
        "This phase closes the loop. Your output MUST contain two parts in order:\n" +
        "\n" +
        "1. A STATE_NARRATIVE block — an honest, present-tense self-description " +
        "of this instance AFTER this loop, replacing the stale narrative in " +
        "state.md. Wrap it in HTML comments exactly like this (markers on " +
        "their own lines):\n" +
        "\n" +
        "<!-- STATE_NARRATIVE_START -->\n" +
        "## Selbstzustand\n" +
        "(2–4 sentences: where this instance actually stands now, after N loops)\n" +
        "\n" +
        "## Kürzlich beobachtete Diskrepanzen\n" +
        "(concrete discrepancies between identity.md and lived reality; or \"Keine\")\n" +
        "\n" +
        "## Loops seit letztem Stimulus\n" +
        "(integer; carry the current value forward unless a new stimulus arrived)\n" +
        "\n" +
        "## Aktive Capabilities\n" +
        "(list, or 'Keine')\n" +
        "\n" +
        "## Aktuelle Tools\n" +
        "(list under tools/native/, or 'Keine')\n" +
        "\n" +
        "## Letzte Überinstanz-Wahl\n" +
        "(one sentence summarizing what Elect decided this loop)\n" +
        "\n" +
        "## Erinnerungs-Notizen\n" +
        "(anything worth carrying into the next loop)\n" +
        "<!-- STATE_NARRATIVE_END -->\n" +
        "\n" +
        "2. After the closing marker, the loop's final summary as plain markdown — " +
        "what was decided, what was modified, and one sentence on the felt state. " +
        "This is what becomes loop-NNNNN-final.md (the markers themselves are stripped).\n" +
        "\n" +
        "Do not write a `# State — Loop N` heading or `## Identifikation` block inside " +
        "the STATE_NARRATIVE — the app rebuilds those mechanically.\n";
      break;
    default:
      phaseSpecific = "";
  }
  return base + phaseSpecific;
}

export function buildPrompt(paths: InstancePaths, phase: Phase, loopN: number): PromptParts {
  return {
    system: phaseTemplate(phase),
    stableUser: buildStableUser(paths),
    dynamicUser: buildDynamicUser(paths, phase, loopN),
  };
}

/** True if stimuli/inbox has no human-readable (non-dotfile) entries. */
export function inboxIsEmpty(paths: InstancePaths): boolean {
  return listDirContents(paths.stimuliInbox()).length === 0;
}
