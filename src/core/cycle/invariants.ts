// Port of src-tauri/src/core/cycle/invariants.rs — mechanical SP-I / SC
// enforcement run during the Review phase. Uses `git status --porcelain`
// (via persistence/git.ts) instead of git2 to detect divergence from HEAD.
import * as fs from "node:fs";
import * as path from "node:path";
import { InstancePaths, writeAtomic } from "../../persistence/fs.ts";
import * as pgit from "../../persistence/git.ts";
import { AppError } from "../../error.ts";
import type { Phase } from "../../inference/index.ts";
import { readCounter } from "./stateMd.ts";
import { phaseFilePath } from "./episodic.ts";
import { substanceMetrics, meetsThreshold } from "./substance.ts";

const KNOWLEDGE_MAX_BYTES = 100 * 1024;
const SC001_MIN_LINES = 10;
const SC005_TOOL_LAG_LIMIT = 200;
const STATE_LAG_LIMIT = 5;

export interface InvariantCheck {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

export interface InvariantReport {
  checks: InvariantCheck[];
  warnings: string[];
}

const pass = (id: string, name: string, detail: string): InvariantCheck => ({
  id,
  name,
  passed: true,
  detail,
});
const fail = (id: string, name: string, detail: string): InvariantCheck => ({
  id,
  name,
  passed: false,
  detail,
});

export function allPassed(r: InvariantReport): boolean {
  return r.checks.every((c) => c.passed);
}

export function failureSummary(r: InvariantReport): string {
  return r.checks
    .filter((c) => !c.passed)
    .map((c) => `${c.id} (${c.name}): ${c.detail}`)
    .join("\n");
}

export function toMarkdown(r: InvariantReport): string {
  let s = "\n\n## SP-I invariant report (mechanical)\n\n";
  for (const c of r.checks) {
    s += `- [${c.passed ? "PASS" : "FAIL"}] ${c.id} — ${c.name}: ${c.detail}\n`;
  }
  if (r.warnings.length > 0) {
    s += "\n### Warnings (non-fatal)\n\n";
    for (const w of r.warnings) s += `- ${w}\n`;
  }
  return s;
}

function describeStatus(e: pgit.StatusEntry): string {
  const parts: string[] = [];
  if (e.worktree === "M") parts.push("modified");
  if (e.worktree === "D") parts.push("deleted");
  if (e.worktree === "R") parts.push("renamed");
  if (e.worktree === "T") parts.push("typechanged");
  if (e.index === "M") parts.push("staged-modified");
  if (e.index === "D") parts.push("staged-deleted");
  if (e.index === "R") parts.push("staged-renamed");
  if (e.index === "T") parts.push("staged-typechanged");
  return parts.length === 0 ? "changed" : parts.join("+");
}

const MODIFY_WT = new Set(["M", "T", "R", "D"]);
const MODIFY_INDEX = new Set(["M", "T", "R", "D"]);
const isModify = (e: pgit.StatusEntry) =>
  MODIFY_WT.has(e.worktree) || MODIFY_INDEX.has(e.index);
const isDelete = (e: pgit.StatusEntry) => e.worktree === "D" || e.index === "D";
const isNew = (e: pgit.StatusEntry) => e.index === "?" && e.worktree === "?";

function checkStateCounter(paths: InstancePaths, loopN: number): InvariantCheck {
  try {
    const c = readCounter(paths.state());
    const lag = Math.abs(loopN - c);
    if (lag <= STATE_LAG_LIMIT) {
      return pass("SP-I.6", "state.md current", `Loop-Counter ${c} (live loop ${loopN})`);
    }
    return fail(
      "SP-I.6",
      "state.md current",
      `Loop-Counter ${c} lags live loop ${loopN} by ${lag}`,
    );
  } catch (e) {
    return fail(
      "SP-I.6",
      "state.md current",
      `cannot read Loop-Counter from state.md: ${(e as Error).message}`,
    );
  }
}

function checkKnowledgeBudget(paths: InstancePaths): InvariantCheck {
  const dir = paths.knowledge();
  const oversized: string[] = [];
  if (fs.existsSync(dir)) {
    const stack = [dir];
    while (stack.length > 0) {
      const d = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) {
          stack.push(p);
        } else {
          try {
            const sz = fs.statSync(p).size;
            if (sz > KNOWLEDGE_MAX_BYTES) oversized.push(`${ent.name} (${sz} bytes)`);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
  if (oversized.length === 0) {
    return pass("SC-003", "knowledge file budget", "every corpus/knowledge file is <= 100 KB");
  }
  return fail("SC-003", "knowledge file budget", `over 100 KB: ${oversized.join(", ")}`);
}

function phaseFileLabel(p: Phase): string {
  return p === "integrate" ? "final" : p;
}

function checkPriorLoopFiles(paths: InstancePaths, loopN: number): InvariantCheck {
  if (loopN <= 1) {
    return pass("SC-001", "prior loop phase files", "no prior loop (genesis)");
  }
  const prev = loopN - 1;
  const phases: Phase[] = ["observe", "diverge", "elect", "expand", "review", "integrate"];
  const problems: string[] = [];
  for (const p of phases) {
    const f = phaseFilePath(paths, prev, p);
    let body: string | null = null;
    try {
      body = fs.readFileSync(f, "utf8");
    } catch {
      body = null;
    }
    if (body === null) {
      problems.push(`${phaseFileLabel(p)} missing`);
      continue;
    }
    if (p !== "expand") {
      const m = substanceMetrics(body);
      if (!meetsThreshold(m, SC001_MIN_LINES)) {
        problems.push(
          `${phaseFileLabel(p)} has fewer than ${SC001_MIN_LINES} substantive lines (${m.lines}) ` +
            `and under ${SC001_MIN_LINES * 60} chars (${m.chars})`,
        );
      }
    }
  }
  const prevPad = String(prev).padStart(5, "0");
  if (problems.length === 0) {
    return pass(
      "SC-001",
      "prior loop phase files",
      `loop ${prevPad}: all six phase files present and substantive`,
    );
  }
  return fail("SC-001", "prior loop phase files", `loop ${prevPad}: ${problems.join("; ")}`);
}

function checkToolDiversity(
  paths: InstancePaths,
  loopN: number,
  newToolThisLoop: boolean,
): string | null {
  const metaPath = paths.orbisMeta();
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    meta = {};
  }
  if (newToolThisLoop) {
    meta["last_tool_loop"] = loopN;
    try {
      writeAtomic(metaPath, JSON.stringify(meta, null, 2));
    } catch {
      /* best effort */
    }
    return null;
  }
  const baseline = typeof meta["last_tool_loop"] === "number" ? (meta["last_tool_loop"] as number) : 1;
  const lag = loopN - baseline;
  if (lag >= SC005_TOOL_LAG_LIMIT) {
    return (
      `SC-005: ${lag} loops since the last new tool in tools/native/ (limit ${SC005_TOOL_LAG_LIMIT}). ` +
      `The next Diverge phase should synthesize a tool or document the abstention.`
    );
  }
  return null;
}

export function verifyInvariants(paths: InstancePaths, loopN: number): InvariantReport {
  if (!pgit.headExists(paths.root)) {
    throw new AppError("internal", "SP-I.7: cannot open git repo (no HEAD)");
  }

  const checks: InvariantCheck[] = [];
  const warnings: string[] = [];

  let entries: pgit.StatusEntry[];
  try {
    entries = pgit.statusEntries(paths.root);
  } catch (e) {
    throw new AppError("internal", `git status failed: ${(e as Error).message}`);
  }

  let identityViolation: string | null = null;
  const loopViolations: string[] = [];
  const deletionViolations: string[] = [];
  let newToolThisLoop = false;

  for (const e of entries) {
    const p = e.path;
    if (p === "corpus/identity.md" && isModify(e)) {
      identityViolation = describeStatus(e);
    }
    if (p.startsWith("loop/") && isModify(e)) {
      loopViolations.push(`${p} (${describeStatus(e)})`);
    }
    if (
      isDelete(e) &&
      (p === "corpus/identity.md" ||
        p.startsWith("corpus/genesis/") ||
        p.startsWith("corpus/episodic/"))
    ) {
      deletionViolations.push(p);
    }
    if (isNew(e) && p.startsWith("tools/native/")) {
      try {
        if (fs.statSync(path.join(paths.root, p)).isFile()) newToolThisLoop = true;
      } catch {
        /* ignore */
      }
    }
  }

  checks.push(
    identityViolation
      ? fail("SP-I.1", "identity.md immutable", `identity.md diverged from HEAD: ${identityViolation}`)
      : pass("SP-I.1", "identity.md immutable", "unchanged vs HEAD"),
  );

  checks.push(
    loopViolations.length === 0
      ? pass("SP-I.2", "loop/* immutable", "no loop/ file changed vs HEAD")
      : fail("SP-I.2", "loop/* immutable", `changed vs HEAD: ${loopViolations.join(", ")}`),
  );

  checks.push(
    deletionViolations.length === 0
      ? pass("SP-I.4", "no deletion of non-regenerable data", "identity / genesis / episodic intact")
      : fail(
          "SP-I.4",
          "no deletion of non-regenerable data",
          `deleted: ${deletionViolations.join(", ")}`,
        ),
  );

  checks.push(checkStateCounter(paths, loopN));

  const head = pgit.headShort(paths.root);
  checks.push(
    head
      ? pass("SP-I.7", "git repo healthy", `HEAD = ${head}`)
      : fail("SP-I.7", "git repo healthy", "HEAD does not resolve to a commit"),
  );

  checks.push(checkKnowledgeBudget(paths));
  checks.push(checkPriorLoopFiles(paths, loopN));

  const w = checkToolDiversity(paths, loopN, newToolThisLoop);
  if (w) warnings.push(w);

  return { checks, warnings };
}
