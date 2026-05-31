// Port of src-tauri/src/core/cycle/episodic.rs — episodic phase-file paths and writes.

import * as path from "node:path";

import { InstancePaths, writeAtomic } from "../../persistence/fs.ts";
import type { Phase } from "../../inference/index.ts";

/** Zero-pad to 5 digits to match Rust's `{:05}`. */
function pad5(n: number): string {
  const neg = n < 0;
  const digits = Math.abs(n).toString();
  const padded = digits.padStart(5, "0");
  return neg ? `-${padded}` : padded;
}

/** `loop-NNNNN-{phase}.md` — but the Integrate phase is written as `final`. */
export function phaseFileName(loopN: number, phase: Phase): string {
  const suffix = phase === "integrate" ? "final" : phase;
  return `loop-${pad5(loopN)}-${suffix}.md`;
}

/** `corpus/episodic/loop-NNNNN-{phase}.md` (absolute path). */
export function phaseFilePath(
  paths: InstancePaths,
  loopN: number,
  phase: Phase,
): string {
  return path.join(paths.episodic(), phaseFileName(loopN, phase));
}

/**
 * Write a phase body to its episodic file. Returns the path written, relative
 * to the instance root (e.g. `corpus/episodic/loop-00001-observe.md`).
 */
export function writePhaseFile(
  paths: InstancePaths,
  loopN: number,
  phase: Phase,
  body: string,
): string {
  const full = phaseFilePath(paths, loopN, phase);
  writeAtomic(full, body);
  return path.relative(paths.root, full);
}
