// Port of src-tauri/src/persistence/fs.rs — InstancePaths + atomic writes.
import { promises as fsp } from "node:fs";
import * as fs from "node:fs";
import * as path from "node:path";
import { AppError } from "../error.ts";

/** All on-disk paths for one instance, relative to its root directory. */
export class InstancePaths {
  root: string;
  constructor(root: string) {
    this.root = root;
  }
  claudeMd() { return path.join(this.root, "CLAUDE.md"); }
  corpus() { return path.join(this.root, "corpus"); }
  identity() { return path.join(this.corpus(), "identity.md"); }
  state() { return path.join(this.corpus(), "state.md"); }
  episodic() { return path.join(this.corpus(), "episodic"); }
  knowledge() { return path.join(this.corpus(), "knowledge"); }
  capabilities() { return path.join(this.corpus(), "capabilities"); }
  genesis() { return path.join(this.corpus(), "genesis"); }
  stimuli() { return path.join(this.root, "stimuli"); }
  stimuliInbox() { return path.join(this.stimuli(), "inbox"); }
  stimuliProcessed() { return path.join(this.stimuli(), "processed"); }
  stimuliStanding() { return path.join(this.stimuli(), "standing"); }
  stimuliOutbox() { return path.join(this.stimuli(), "outbox"); }
  agents() { return path.join(this.root, "agents"); }
  agentsSpawned() { return path.join(this.agents(), "spawned"); }
  agentsArchive() { return path.join(this.agents(), "archive"); }
  tools() { return path.join(this.root, "tools"); }
  toolsNative() { return path.join(this.tools(), "native"); }
  toolsExternal() { return path.join(this.tools(), "external"); }
  superinstance() { return path.join(this.root, "superinstance"); }
  superinstanceCurrent() { return path.join(this.superinstance(), "current.md"); }
  loopDir() { return path.join(this.root, "loop"); }
  orbisMeta() { return path.join(this.root, ".orbis-meta.json"); }

  allDirs(): string[] {
    return [
      this.corpus(), this.episodic(), this.knowledge(), this.capabilities(),
      this.genesis(), this.stimuli(), this.stimuliInbox(), this.stimuliProcessed(),
      this.stimuliStanding(), this.stimuliOutbox(), this.agents(), this.agentsSpawned(),
      this.agentsArchive(), this.tools(), this.toolsNative(), this.toolsExternal(),
      this.superinstance(), this.loopDir(),
    ];
  }
}

export function createDirs(paths: InstancePaths): void {
  fs.mkdirSync(paths.root, { recursive: true });
  for (const dir of paths.allDirs()) fs.mkdirSync(dir, { recursive: true });
}

/** Write to <path>.tmp then rename — POSIX-atomic against crashes. */
export function writeAtomic(filePath: string, contents: string): void {
  const parent = path.dirname(filePath);
  fs.mkdirSync(parent, { recursive: true });
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, filePath);
}

export async function writeAtomicAsync(filePath: string, contents: string): Promise<void> {
  const parent = path.dirname(filePath);
  await fsp.mkdir(parent, { recursive: true });
  const tmp = filePath + ".tmp";
  await fsp.writeFile(tmp, contents);
  await fsp.rename(tmp, filePath);
}

export function readToString(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e: any) {
    if (e?.code === "ENOENT") throw new AppError("not_found", filePath);
    throw new AppError("io", String(e?.message ?? e));
  }
}

export function readOrNull(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

/** List `.md` files (no dotfiles) in a directory, sorted ascending. Empty if absent. */
export function listMdFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((n) => !n.startsWith(".") && n.toLowerCase().endsWith(".md"))
    .sort();
}
