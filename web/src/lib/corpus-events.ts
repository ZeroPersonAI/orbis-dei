import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "./transport";
import { CORPUS_CHANGED, type CorpusChangedEvent } from "./tauri-bindings";

/**
 * Subscribe to `corpus:changed` events for one instance. Returns a tick counter
 * that increments whenever that instance's corpus directory changes on disk —
 * panels depend on the tick to know when to re-read their files.
 */
export function useCorpusWatch(instanceId: string): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    listen<CorpusChangedEvent>(CORPUS_CHANGED, (e) => {
      if (e.payload.instance_id === instanceId) {
        setTick((t) => t + 1);
      }
    }).then((u) => {
      if (cancelled) u();
      else unlisten = u;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [instanceId]);

  return tick;
}
