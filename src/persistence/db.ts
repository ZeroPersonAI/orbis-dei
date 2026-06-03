// SQLite schema + migrations. Uses better-sqlite3 (synchronous, blocking API).
import Database from "better-sqlite3";

export type DB = Database.Database;

export function openDb(dbPath: string): DB {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

export function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS instances (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        path             TEXT NOT NULL,
        created_at       TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'idle',
        current_phase    TEXT,
        loop_counter     INTEGER NOT NULL DEFAULT 1,
        last_stimulus_at TEXT,
        ollama_model     TEXT NOT NULL DEFAULT 'gemma4:e4b',
        routing_mode     TEXT NOT NULL DEFAULT 'hybrid',
        loops_since_last_stimulus       INTEGER NOT NULL DEFAULT 0,
        auto_mode_enabled               INTEGER NOT NULL DEFAULT 0,
        auto_reply_enabled              INTEGER NOT NULL DEFAULT 0,
        auto_reply_prompt               TEXT,
        auto_stimulus_enabled           INTEGER NOT NULL DEFAULT 0,
        auto_stimulus_interval_minutes  INTEGER NOT NULL DEFAULT 15,
        auto_stimulus_prompt            TEXT,
        phase_routing                   TEXT,
        language                        TEXT NOT NULL DEFAULT 'en'
    );

    CREATE TABLE IF NOT EXISTS loop_events (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        instance_id   TEXT NOT NULL,
        loop_n        INTEGER NOT NULL,
        phase         TEXT NOT NULL,
        started_at    TEXT NOT NULL,
        finished_at   TEXT,
        model_used    TEXT,
        tokens_in     INTEGER,
        tokens_out    INTEGER,
        outcome       TEXT,
        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_loop_events_instance
        ON loop_events (instance_id, loop_n);

    CREATE TABLE IF NOT EXISTS inference_calls (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        loop_event_id  INTEGER,
        instance_id    TEXT NOT NULL,
        provider       TEXT NOT NULL,
        model          TEXT NOT NULL,
        input_tokens   INTEGER,
        output_tokens  INTEGER,
        latency_ms     INTEGER,
        rate_limited   INTEGER NOT NULL DEFAULT 0,
        queue_wait_ms  INTEGER,
        error          TEXT,
        created_at     TEXT NOT NULL,
        cache_create_tokens INTEGER,
        cache_read_tokens   INTEGER,
        FOREIGN KEY (loop_event_id) REFERENCES loop_events(id) ON DELETE SET NULL,
        FOREIGN KEY (instance_id)   REFERENCES instances(id)   ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_inference_calls_instance_time
        ON inference_calls (instance_id, created_at);

    CREATE TABLE IF NOT EXISTS settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
  `);

  // Additive migrations for databases created before a column existed. Existing
  // instances were born in German, so the default matches their corpus.
  const cols = (db.prepare("PRAGMA table_info(instances)").all() as { name: string }[]).map(
    (c) => c.name,
  );
  if (!cols.includes("language")) {
    db.exec("ALTER TABLE instances ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
  }

  // Per-instance coupling level (mirror/gated/open) replaces the old global
  // network_access + allow_tool_execution toggles. New instances default to the
  // safe (closed) "mirror". Existing instances are backfilled from the old
  // global settings so current behavior is preserved: an instance only becomes
  // coupled if the habitat previously had BOTH network access and tools on.
  if (!cols.includes("coupling_level")) {
    db.exec("ALTER TABLE instances ADD COLUMN coupling_level TEXT NOT NULL DEFAULT 'mirror'");
    const getVal = (k: string): string | null => {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(k) as
        | { value: string }
        | undefined;
      return row?.value ?? null;
    };
    const net = getVal("network_access");
    const tools = getVal("allow_tool_execution") === "true";
    const level = tools && net === "open" ? "open" : tools && net === "gated" ? "gated" : "mirror";
    db.prepare("UPDATE instances SET coupling_level = ?").run(level);
  }

  // Drop the legacy cost_usd column from databases created before cost tracking
  // was removed. Token counts are kept; only the money figure is gone. This is
  // best-effort cleanup: inserts already omit cost_usd, so a leftover (nullable)
  // column is harmless — a failed DROP (old SQLite, etc.) must not block startup.
  const icCols = (
    db.prepare("PRAGMA table_info(inference_calls)").all() as { name: string }[]
  ).map((c) => c.name);
  if (icCols.includes("cost_usd")) {
    try {
      db.exec("ALTER TABLE inference_calls DROP COLUMN cost_usd");
    } catch (e) {
      console.warn(
        "could not drop legacy cost_usd column (harmless, leaving it):",
        e instanceof Error ? e.message : e,
      );
    }
  }
}
