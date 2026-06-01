// Git operations using the system `git` binary. All operations are synchronous
// child processes, giving blocking semantics inside the loop.
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { AppError } from "../error.ts";

const AUTHOR_NAME = "Orbis Dei";
const AUTHOR_EMAIL = "habitat@orbisdei.local";

function git(repoPath: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", repoPath, ...args], {
      encoding: "utf8",
      // identity is forced per-invocation so we never depend on global git config
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: AUTHOR_NAME,
        GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
        GIT_COMMITTER_NAME: AUTHOR_NAME,
        GIT_COMMITTER_EMAIL: AUTHOR_EMAIL,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (e: any) {
    const detail = e?.stderr?.toString?.() || e?.message || String(e);
    throw new AppError("git", detail.trim());
  }
}

export function initRepo(repoPath: string): void {
  fs.mkdirSync(repoPath, { recursive: true });
  git(repoPath, ["init", "-q"]);
}

/** Current HEAD commit hash — used as a rollback anchor before a loop runs. */
export function headOid(repoPath: string): string {
  return git(repoPath, ["rev-parse", "HEAD"]);
}

/** `git reset --hard <oid>` — discards tracked changes. */
export function resetHard(repoPath: string, oid: string): void {
  git(repoPath, ["reset", "--hard", oid]);
}

/** `git clean -fd` — removes untracked files/dirs left by a failed loop. */
export function cleanUntracked(repoPath: string): void {
  git(repoPath, ["clean", "-fd"]);
}

/** Stage everything and commit. Works for both genesis and subsequent commits. */
export function commitAll(repoPath: string, message: string): void {
  git(repoPath, ["add", "-A"]);
  // allow-empty keeps integrate idempotent if a loop produced no tracked change
  git(repoPath, ["commit", "-q", "--allow-empty", "-m", message]);
}

export interface StatusEntry {
  /** index (staged) status char, e.g. 'M', 'A', 'D', 'R', ' ', '?' */
  index: string;
  /** worktree status char */
  worktree: string;
  path: string;
}

/**
 * Parse `git status --porcelain` (vs HEAD + worktree). Used by the invariant
 * checks to detect whether protected files diverged from HEAD.
 */
export function statusEntries(repoPath: string): StatusEntry[] {
  const out = git(repoPath, ["status", "--porcelain", "-z", "--untracked-files=all"]);
  if (!out) return [];
  const parts = out.split("\0").filter((s) => s.length > 0);
  const entries: StatusEntry[] = [];
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    const index = rec[0] ?? " ";
    const worktree = rec[1] ?? " ";
    let p = rec.slice(3);
    // Renames/copies put the new name in this record and the old name in the next.
    if (index === "R" || index === "C") {
      i++; // skip the paired old-path record
    }
    entries.push({ index, worktree, path: p });
  }
  return entries;
}

/** True if the repo has at least one commit (HEAD resolves). */
export function headExists(repoPath: string): boolean {
  try {
    git(repoPath, ["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

/** Short HEAD hash for invariant reporting; empty string if none. */
export function headShort(repoPath: string): string {
  try {
    return git(repoPath, ["rev-parse", "--short", "HEAD"]);
  } catch {
    return "";
  }
}
