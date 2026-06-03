// The shared application state. `events` is the in-process event bus, `db` is
// the better-sqlite3 connection (single-threaded, no mutex needed), `secrets`
// is the encrypted API-key store.
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { openDb, type DB } from "./persistence/db.ts";
import { loadSettings } from "./persistence/settings.ts";
import { SecretStore } from "./persistence/secrets.ts";
import { Governor, type GovernorSettings } from "./inference/governor/index.ts";
import { EventBus } from "./events.ts";
import { Orchestrator } from "./core/orchestrator.ts";
import { AutoModeManager } from "./core/autoMode.ts";

export interface ViewerWatcher {
  instanceId: string;
  close: () => void;
}

/** Resolve the habitat data dir: the platform's per-user data directory plus
 *  /OrbisDei, with an ORBIS_DATA_DIR override (useful for the server / tests). */
export function habitatDataDir(): string {
  const override = process.env.ORBIS_DATA_DIR;
  if (override && override.length > 0) return override;
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", "OrbisDei");
    case "win32":
      return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "OrbisDei");
    default:
      return path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), "OrbisDei");
  }
}

export class AppState {
  dataDir: string;
  instancesDir: string;
  db: DB;
  governor: Governor;
  events: EventBus;
  secrets: SecretStore;
  orchestrator: Orchestrator;
  autoMode: AutoModeManager;
  viewerWatcher: ViewerWatcher | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.instancesDir = path.join(dataDir, "instances");
    fs.mkdirSync(this.instancesDir, { recursive: true });

    this.db = openDb(path.join(dataDir, "habitat.db"));
    this.secrets = new SecretStore(dataDir);
    this.events = new EventBus();

    const s = loadSettings(this.db);
    const govSettings: GovernorSettings = {
      rpm: s.governor_rpm,
      itpm: s.governor_itpm,
      otpm: s.governor_otpm,
    };
    this.governor = new Governor(govSettings);

    this.orchestrator = new Orchestrator(this);
    this.autoMode = new AutoModeManager(this);
  }
}
