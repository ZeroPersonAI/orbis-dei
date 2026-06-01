// Instance bootstrap + DB row mapping. Field names are snake_case to match the
// JSON the frontend expects.
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { DB } from "../persistence/db.ts";
import { InstancePaths, createDirs, writeAtomic } from "../persistence/fs.ts";
import * as pgit from "../persistence/git.ts";
import * as templates from "../templates.ts";
import { validateRoutingMode } from "../inference/provider.ts";
import { AppError, notFound, invalidInput } from "../error.ts";

export interface Instance {
  id: string;
  name: string;
  path: string;
  created_at: string;
  status: string;
  current_phase: string | null;
  loop_counter: number;
  last_stimulus_at: string | null;
  routing_mode: string;
  phase_routing: string | null;
  loops_since_last_stimulus: number;
  auto_mode_enabled: boolean;
  auto_reply_enabled: boolean;
  auto_reply_prompt: string | null;
  auto_stimulus_enabled: boolean;
  auto_stimulus_interval_minutes: number;
  auto_stimulus_prompt: string | null;
  /** Organism language ("en"|"de"|"zh"|"es"|"fr"), chosen at creation. */
  language: string;
}

export const DEFAULT_ROUTING_MODE = "anthropic";

/** Create a new instance on disk (layout, templates, git genesis commit). */
export function bootstrap(
  name: string,
  routingMode: string,
  language: string,
  instancesDir: string,
): Instance {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw invalidInput("instance name must not be empty");
  if (trimmed.length > 120) throw invalidInput("instance name too long (max 120)");

  let routing = routingMode.trim();
  if (routing.length === 0) routing = DEFAULT_ROUTING_MODE;
  validateRoutingMode(routing);

  const lang = templates.normalizeLang(language);

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const instancePath = path.join(instancesDir, id);
  const paths = new InstancePaths(instancePath);
  createDirs(paths);

  pgit.initRepo(instancePath);

  writeAtomic(paths.claudeMd(), templates.claudeMd(lang));
  writeAtomic(paths.identity(), templates.identityMd(lang));
  writeAtomic(paths.state(), templates.renderStateMd(createdAt, lang));
  writeAtomic(paths.superinstanceCurrent(), templates.superinstanceMd(lang));

  for (const [filename, content] of templates.standingConcerns(lang)) {
    writeAtomic(path.join(paths.stimuliStanding(), filename), content);
  }
  for (const [filename, content] of templates.loopPhases(lang)) {
    writeAtomic(path.join(paths.loopDir(), filename), content);
  }

  const meta = {
    id,
    name: trimmed,
    created_at: createdAt,
    schema_version: 3,
    routing_mode: routing,
    language: lang,
  };
  writeAtomic(paths.orbisMeta(), JSON.stringify(meta, null, 2));

  pgit.commitAll(instancePath, `genesis: instance "${trimmed}" born`);

  return {
    id,
    name: trimmed,
    path: instancePath,
    created_at: createdAt,
    status: "idle",
    current_phase: null,
    loop_counter: 1,
    last_stimulus_at: null,
    routing_mode: routing,
    phase_routing: null,
    loops_since_last_stimulus: 0,
    auto_mode_enabled: false,
    auto_reply_enabled: false,
    auto_reply_prompt: null,
    auto_stimulus_enabled: false,
    auto_stimulus_interval_minutes: 15,
    auto_stimulus_prompt: null,
    language: lang,
  };
}

export function insert(db: DB, inst: Instance): void {
  db.prepare(
    `INSERT INTO instances
       (id, name, path, created_at, status, loop_counter, routing_mode, phase_routing, language)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    inst.id,
    inst.name,
    inst.path,
    inst.created_at,
    inst.status,
    inst.loop_counter,
    inst.routing_mode,
    inst.phase_routing,
    inst.language,
  );
}

const COLS = `id, name, path, created_at, status, current_phase,
  loop_counter, last_stimulus_at, routing_mode, phase_routing,
  loops_since_last_stimulus, auto_mode_enabled, auto_reply_enabled,
  auto_reply_prompt, auto_stimulus_enabled,
  auto_stimulus_interval_minutes, auto_stimulus_prompt, language`;

function rowToInstance(r: any): Instance {
  return {
    id: r.id,
    name: r.name,
    path: r.path,
    created_at: r.created_at,
    status: r.status,
    current_phase: r.current_phase ?? null,
    loop_counter: r.loop_counter,
    last_stimulus_at: r.last_stimulus_at ?? null,
    routing_mode: r.routing_mode,
    phase_routing: r.phase_routing ?? null,
    loops_since_last_stimulus: r.loops_since_last_stimulus,
    auto_mode_enabled: !!r.auto_mode_enabled,
    auto_reply_enabled: !!r.auto_reply_enabled,
    auto_reply_prompt: r.auto_reply_prompt ?? null,
    auto_stimulus_enabled: !!r.auto_stimulus_enabled,
    auto_stimulus_interval_minutes: r.auto_stimulus_interval_minutes,
    auto_stimulus_prompt: r.auto_stimulus_prompt ?? null,
    language: r.language ?? "de",
  };
}

export function listAll(db: DB): Instance[] {
  const rows = db.prepare(`SELECT ${COLS} FROM instances ORDER BY created_at DESC`).all();
  return rows.map(rowToInstance);
}

export function get(db: DB, id: string): Instance {
  const row = db.prepare(`SELECT ${COLS} FROM instances WHERE id = ?`).get(id);
  if (!row) throw notFound(`instance ${id}`);
  return rowToInstance(row);
}

export function setStatusPhaseCounter(
  db: DB,
  id: string,
  status: string,
  currentPhase: string | null,
  loopCounter: number,
): void {
  db.prepare(
    `UPDATE instances SET status = ?, current_phase = ?, loop_counter = ? WHERE id = ?`,
  ).run(status, currentPhase, loopCounter, id);
}

export function updateAutoConfig(
  db: DB,
  id: string,
  autoModeEnabled: boolean,
  autoReplyEnabled: boolean,
  autoReplyPrompt: string | null,
  autoStimulusEnabled: boolean,
  autoStimulusIntervalMinutes: number,
  autoStimulusPrompt: string | null,
): void {
  const norm = (p: string | null): string | null => {
    if (p === null || p === undefined) return null;
    const t = p.trim();
    return t.length === 0 ? null : t;
  };
  const interval = Math.max(1, autoStimulusIntervalMinutes);
  const info = db
    .prepare(
      `UPDATE instances
         SET auto_mode_enabled = ?, auto_reply_enabled = ?, auto_reply_prompt = ?,
             auto_stimulus_enabled = ?, auto_stimulus_interval_minutes = ?, auto_stimulus_prompt = ?
       WHERE id = ?`,
    )
    .run(
      autoModeEnabled ? 1 : 0,
      autoReplyEnabled ? 1 : 0,
      norm(autoReplyPrompt),
      autoStimulusEnabled ? 1 : 0,
      interval,
      norm(autoStimulusPrompt),
      id,
    );
  if (info.changes === 0) throw notFound(`instance ${id}`);
}

export function updateRouting(
  db: DB,
  id: string,
  routingMode: string,
  phaseRouting: string | null,
): void {
  const info = db
    .prepare(`UPDATE instances SET routing_mode = ?, phase_routing = ? WHERE id = ?`)
    .run(routingMode, phaseRouting, id);
  if (info.changes === 0) throw notFound(`instance ${id}`);
}

export function pathOf(db: DB, id: string): string {
  const row = db.prepare(`SELECT path FROM instances WHERE id = ?`).get(id) as
    | { path: string }
    | undefined;
  if (!row) throw notFound(`instance ${id}`);
  return row.path;
}

export function deleteRow(db: DB, id: string): string {
  const p = pathOf(db, id);
  const info = db.prepare(`DELETE FROM instances WHERE id = ?`).run(id);
  if (info.changes === 0) throw notFound(`instance ${id}`);
  return p;
}

export { AppError };
