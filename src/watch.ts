// Watches an instance's corpus/ dir with chokidar and emits a debounced
// `corpus:changed` event.
import chokidar, { type FSWatcher } from "chokidar";
import type { EventBus } from "./events.ts";

const DEBOUNCE_MS = 300;

export class InstanceWatcher {
  instanceId: string;
  private watcher: FSWatcher;
  private timer: NodeJS.Timeout | null = null;

  private constructor(instanceId: string, watcher: FSWatcher) {
    this.instanceId = instanceId;
    this.watcher = watcher;
  }

  static start(instanceId: string, corpusPath: string, events: EventBus): InstanceWatcher {
    const watcher = chokidar.watch(corpusPath, {
      ignoreInitial: true,
      persistent: true,
      depth: 99,
    });
    const iw = new InstanceWatcher(instanceId, watcher);
    const onChange = () => {
      if (iw.timer) return; // already scheduled; coalesce the burst
      iw.timer = setTimeout(() => {
        iw.timer = null;
        events.emit("corpus:changed", { instance_id: instanceId });
      }, DEBOUNCE_MS);
    };
    watcher.on("all", onChange);
    // An unhandled 'error' event on the FSWatcher (an EventEmitter) would throw
    // as an uncaught exception. Log it so a watch failure degrades to "no live
    // corpus updates" instead of crashing the process.
    watcher.on("error", (err: unknown) =>
      console.warn(`corpus watcher error (instance ${instanceId}):`, err),
    );
    return iw;
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    void this.watcher.close();
  }
}
