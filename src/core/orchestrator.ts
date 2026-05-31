// Port of src-tauri/src/core/orchestrator.rs — per-instance background loops.
// JS is single-threaded, so the handles map needs no mutex; the TOCTOU guard
// the Rust achieved with a lock is automatic between awaits here.
import type { AppState } from "../state.ts";
import { runOneCycle } from "./cycle/index.ts";
import * as instance from "./instance.ts";
import { loadSettings } from "../persistence/settings.ts";
import { AppError, invalidInput, notFound } from "../error.ts";
import { CancellationToken } from "../util/cancel.ts";

interface DaemonHandle {
  cancel: CancellationToken;
}

export class Orchestrator {
  private handles = new Map<string, DaemonHandle>();

  constructor(private state: AppState) {}

  isRunning(id: string): boolean {
    return this.handles.has(id);
  }

  runningCount(): number {
    return this.handles.size;
  }

  runningIds(): string[] {
    return [...this.handles.keys()];
  }

  async start(instanceId: string): Promise<void> {
    if (this.handles.has(instanceId)) {
      throw invalidInput(`daemon already running for ${instanceId}`);
    }
    const cap = loadSettings(this.state.db).max_concurrent_daemons;
    if (this.handles.size >= cap) {
      this.state.events.emit("daemon:cap_blocked", { instance_id: instanceId, cap });
      throw invalidInput(`max_concurrent_daemons cap reached (${cap})`);
    }

    // Verifies existence + marks running for auto-resume on restart.
    const inst = instance.get(this.state.db, instanceId);
    instance.setStatusPhaseCounter(this.state.db, instanceId, "running", null, inst.loop_counter);

    const cancel = new CancellationToken();
    this.handles.set(instanceId, { cancel });
    this.state.events.emit("daemon:started", { instance_id: instanceId });

    // Fire-and-forget the loop body.
    void this.daemonBody(instanceId, cancel);
  }

  async stop(instanceId: string): Promise<void> {
    const handle = this.handles.get(instanceId);
    if (!handle) throw notFound(`no daemon running for ${instanceId}`);
    this.handles.delete(instanceId);
    handle.cancel.cancel();
    try {
      const inst = instance.get(this.state.db, instanceId);
      instance.setStatusPhaseCounter(this.state.db, instanceId, "paused", null, inst.loop_counter);
    } catch {
      /* instance may have been deleted */
    }
    // Emit immediately so the UI reacts the moment Pause is clicked. The handle
    // is already gone, so cancellation of an in-flight cycle only propagates at
    // the next phase boundary — too slow to drive the button. (daemonBody may
    // emit a second, identical daemon:stopped when it actually unwinds; the UI
    // treats both as idempotent "running = false".) Mirrors pauseAll().
    this.state.events.emit("daemon:stopped", { instance_id: instanceId, reason: "manual" });
  }

  async pauseAll(): Promise<number> {
    const ids = [...this.handles.keys()];
    const count = ids.length;
    for (const id of ids) this.handles.get(id)?.cancel.cancel();
    this.handles.clear();
    for (const id of ids) {
      try {
        const inst = instance.get(this.state.db, id);
        instance.setStatusPhaseCounter(this.state.db, id, "paused", null, inst.loop_counter);
      } catch {
        /* ignore */
      }
    }
    for (const id of ids) {
      this.state.events.emit("daemon:stopped", { instance_id: id, reason: "pause_all" });
    }
    return count;
  }

  private markStatus(id: string, status: string, loopCounter: number): void {
    try {
      instance.setStatusPhaseCounter(this.state.db, id, status, null, loopCounter);
    } catch {
      /* ignore */
    }
  }

  private async daemonBody(instanceId: string, cancel: CancellationToken): Promise<void> {
    let exitReason = "manual";

    while (!cancel.isCancelled) {
      let inst: instance.Instance;
      let boredomThreshold: number;
      try {
        inst = instance.get(this.state.db, instanceId);
        boredomThreshold = loadSettings(this.state.db).boredom_threshold;
      } catch {
        break;
      }

      if (inst.loops_since_last_stimulus >= boredomThreshold) {
        this.markStatus(instanceId, "boredom_pause", inst.loop_counter);
        exitReason = "boredom";
        break;
      }

      try {
        const result = await runOneCycle(inst, this.state, cancel);
        const nextBoredom = result.inbox_was_empty ? inst.loops_since_last_stimulus + 1 : 0;
        try {
          this.state.db
            .prepare(
              `UPDATE instances SET loops_since_last_stimulus = ?, loop_counter = ? WHERE id = ?`,
            )
            .run(nextBoredom, result.final_counter, instanceId);
        } catch {
          /* ignore */
        }
      } catch (e) {
        const err = e instanceof AppError ? e : new AppError("internal", String(e));
        if (err.isCancellation) {
          this.markStatus(instanceId, "paused", inst.loop_counter);
          exitReason = "manual";
          break;
        }
        this.markStatus(instanceId, "error", inst.loop_counter);
        exitReason = "error";
        break;
      }

      // Inter-loop pause with a fast cancellation path.
      await cancel.sleep(1000);
      if (cancel.isCancelled) {
        exitReason = "manual";
        break;
      }
    }

    this.handles.delete(instanceId);
    this.state.events.emit("daemon:stopped", { instance_id: instanceId, reason: exitReason });
  }

  /** Auto-resume instances that were `status='running'` at shutdown. */
  async autoResume(): Promise<number> {
    const cap = loadSettings(this.state.db).max_concurrent_daemons;
    const rows = this.state.db
      .prepare(`SELECT id FROM instances WHERE status='running' ORDER BY created_at LIMIT ?`)
      .all(cap) as { id: string }[];
    let resumed = 0;
    for (const { id } of rows) {
      try {
        await this.start(id);
        resumed += 1;
      } catch {
        /* skip */
      }
    }
    return resumed;
  }
}
