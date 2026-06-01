// HTTP + WebSocket server:
//  - each command  → POST /api/command/<name>  (JSON body = invoke args)
//  - each event    → broadcast over /ws         ({ event, payload })
//  - the bundled frontend → served from web/dist
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { AppState, habitatDataDir } from "./state.ts";
import { buildCommands } from "./commands/index.ts";
import { AppError, toAppError } from "./error.ts";
import { spawnTelegram } from "./telegram.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(here, "..", "web", "dist");
const PORT = Number(process.env.PORT ?? 1421);

// A background daemon / auto-mode task or a stray WebSocket error must never be
// able to take the whole server down silently. Node aborts the process on an
// unhandled rejection by default; we log it with a full stack and keep running.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

async function main() {
  const dataDir = habitatDataDir();
  const state = new AppState(dataDir);
  const commands = buildCommands(state);

  const app = express();
  app.use(express.json({ limit: "16mb" }));

  // --- command dispatch ---
  app.post("/api/command/:name", async (req, res) => {
    const name = req.params.name;
    const handler = commands[name];
    if (!handler) {
      res.status(404).json({ error: `unknown command: ${name}` });
      return;
    }
    try {
      const value = await handler(req.body ?? {}, state);
      // `undefined` (void commands) serialises to null.
      res.json({ value: value === undefined ? null : value });
    } catch (e) {
      const err: AppError = toAppError(e);
      const status =
        err.kind === "not_found" ? 404 : err.kind === "invalid_input" ? 400 : 500;
      res.status(status).json({ error: err.toDisplay() });
    }
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // --- static frontend ---
  if (fs.existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
    app.get("*", (_req, res) => res.sendFile(path.join(WEB_DIST, "index.html")));
  } else {
    app.get("/", (_req, res) =>
      res
        .status(200)
        .send(
          "<h1>Orbis Dei server</h1><p>The frontend is not built yet. Run " +
            "<code>npm run build:web</code>, then reload. The API is live at " +
            "<code>/api/command/&lt;name&gt;</code>.</p>",
        ),
    );
  }

  const server = createServer(app);

  // --- event bridge: EventBus → all WS clients ---
  const wss = new WebSocketServer({ server, path: "/ws" });
  state.events.subscribe((e) => {
    const data = JSON.stringify(e);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(data);
    }
  });

  server.listen(PORT, () => {
    console.log(`Orbis Dei server listening on http://localhost:${PORT}`);
    console.log(`  data dir: ${dataDir}`);
    if (!fs.existsSync(WEB_DIST)) console.log("  frontend not built — run: npm run build:web");
  });

  // --- resume background work that was active at shutdown ---
  try {
    const resumed = await state.orchestrator.autoResume();
    if (resumed > 0) console.log(`  auto-resumed ${resumed} daemon(s)`);
  } catch (e) {
    console.warn("auto-resume failed:", e);
  }
  try {
    await state.autoMode.resumeEnabled();
  } catch (e) {
    console.warn("auto-mode resume failed:", e);
  }

  // --- optional Telegram bot (bails out cheaply if disabled) ---
  spawnTelegram(state);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
