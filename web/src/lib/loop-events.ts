import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "./transport";
import {
  LOOP_EVENTS,
  type LoopFailedEvent,
  type LoopResult,
  type PhaseEvent,
} from "./tauri-bindings";

export type LoopRunState =
  | { kind: "idle" }
  | { kind: "running"; phase: string; loop_n: number }
  | { kind: "succeeded"; result: LoopResult }
  | { kind: "failed"; loop_n: number; error: string };

export function useLoopState(instanceId: string): LoopRunState {
  const [state, setState] = useState<LoopRunState>({ kind: "idle" });

  useEffect(() => {
    let unlisteners: UnlistenFn[] = [];
    let cancelled = false;

    async function subscribe() {
      const u1 = await listen<PhaseEvent>(LOOP_EVENTS.phaseStarted, (e) => {
        if (e.payload.instance_id !== instanceId) return;
        setState({
          kind: "running",
          phase: e.payload.phase,
          loop_n: e.payload.loop_n,
        });
      });
      const u2 = await listen<LoopResult>(LOOP_EVENTS.completed, (e) => {
        if (e.payload.instance_id !== instanceId) return;
        setState({ kind: "succeeded", result: e.payload });
      });
      const u3 = await listen<LoopFailedEvent>(LOOP_EVENTS.failed, (e) => {
        if (e.payload.instance_id !== instanceId) return;
        setState({
          kind: "failed",
          loop_n: e.payload.loop_n,
          error: e.payload.error,
        });
      });

      if (cancelled) {
        u1();
        u2();
        u3();
      } else {
        unlisteners = [u1, u2, u3];
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
