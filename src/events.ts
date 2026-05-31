// Replaces Tauri's `app.emit(name, payload)`. A tiny pub/sub bus that the
// WebSocket server subscribes to and forwards verbatim to every connected
// browser. Event names + payload shapes are identical to the Tauri originals
// so the frontend's listeners work unchanged.

export interface OrbisEvent {
  event: string;
  payload: unknown;
}

type Subscriber = (e: OrbisEvent) => void;

export class EventBus {
  private subscribers = new Set<Subscriber>();

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  emit(event: string, payload: unknown): void {
    const msg: OrbisEvent = { event, payload };
    for (const fn of this.subscribers) {
      try {
        fn(msg);
      } catch {
        // a broken subscriber must never break the emitter
      }
    }
  }
}
