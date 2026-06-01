// HTTP + WebSocket transport: `invoke` posts to the server's command endpoint;
// `listen` subscribes to a shared WebSocket that relays the server's EventBus.
// The signatures match the frontend's existing `invoke`/`listen` usage.

export type UnlistenFn = () => void;

/** `invoke<T>(cmd, args)`: resolves the value or rejects with the server's error
 *  string (so existing `String(e)` handlers behave the same). */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/command/${cmd}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });
  let body: any;
  try {
    body = await res.json();
  } catch {
    throw `request failed (${res.status})`;
  }
  if (!res.ok) {
    // Reject with the bare string.
    throw typeof body?.error === "string" ? body.error : `request failed (${res.status})`;
  }
  return body.value as T;
}

// ---- shared WebSocket event bus --------------------------------------------

interface ServerEvent<T> {
  event: string;
  payload: T;
}

type Handler = (e: ServerEvent<unknown>) => void;

const handlers = new Map<string, Set<Handler>>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function ensureSocket(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const proto = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${proto}://${location.host}/ws`);

  socket.onmessage = (ev) => {
    let msg: ServerEvent<unknown>;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const set = handlers.get(msg.event);
    if (set) for (const h of set) h(msg);
  };
  socket.onclose = () => {
    socket = null;
    // Reconnect as long as anything is still listening.
    if (handlers.size > 0 && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        ensureSocket();
      }, 1000);
    }
  };
  socket.onerror = () => {
    socket?.close();
  };
}

/** `listen<T>(event, handler)`. */
export async function listen<T>(
  event: string,
  handler: (e: ServerEvent<T>) => void,
): Promise<UnlistenFn> {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  const wrapped = handler as Handler;
  set.add(wrapped);
  ensureSocket();

  return () => {
    const s = handlers.get(event);
    if (s) {
      s.delete(wrapped);
      if (s.size === 0) handlers.delete(event);
    }
  };
}
