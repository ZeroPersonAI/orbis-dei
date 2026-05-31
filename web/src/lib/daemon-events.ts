import { useCallback, useEffect, useState } from "react";
import { listen, type UnlistenFn } from "./transport";
import {
  api,
  DAEMON_EVENTS,
  type DaemonStartedEvent,
  type DaemonStoppedEvent,
} from "./tauri-bindings";

export interface DaemonState {
  running: boolean;
  /** Last stop reason (if the daemon stopped on its own). */
  lastStopReason?: DaemonStoppedEvent["reason"];
}

/** Track whether the daemon is running for a single instance. */
export function useDaemonState(instanceId: string, refreshKey?: number): DaemonState {
  const [state, setState] = useState<DaemonState>({ running: false });

  const refetch = useCallback(async () => {
    try {
      const running = await api.daemonStatus(instanceId);
      setState((s) => ({ ...s, running }));
    } catch {
      /* ignore */
    }
  }, [instanceId]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  useEffect(() => {
    let unlisteners: UnlistenFn[] = [];
    let cancelled = false;
    async function subscribe() {
      const u1 = await listen<DaemonStartedEvent>(DAEMON_EVENTS.started, (e) => {
        if (e.payload.instance_id !== instanceId) return;
        setState({ running: true });
      });
      const u2 = await listen<DaemonStoppedEvent>(DAEMON_EVENTS.stopped, (e) => {
        if (e.payload.instance_id !== instanceId) return;
        setState({ running: false, lastStopReason: e.payload.reason });
      });
      if (cancelled) {
        u1();
        u2();
      } else {
        unlisteners = [u1, u2];
      }
    }
    subscribe();
    return () => {
      cancelled = true;
      unlisteners.forEach((u) => u());
    };
  }, [instanceId]);

  return state;
}

/** Track the global count of running daemons across all instances. */
export function useRunningDaemonCount(refreshKey?: number): number {
  const [count, setCount] = useState(0);

  const refetch = useCallback(async () => {
    try {
      const ids = await api.listRunningDaemons();
      setCount(ids.length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  useEffect(() => {
    let unlisteners: UnlistenFn[] = [];
    let cancelled = false;
    async function subscribe() {
      const u1 = await listen(DAEMON_EVENTS.started, () => {
        refetch();
      });
      const u2 = await listen(DAEMON_EVENTS.stopped, () => {
        refetch();
      });
      if (cancelled) {
        u1();
        u2();
      } else {
        unlisteners = [u1, u2];
      }
    }
    subscribe();
    return () => {
      cancelled = true;
      unlisteners.forEach((u) => u());
    };
  }, [refetch]);

  return count;
}
