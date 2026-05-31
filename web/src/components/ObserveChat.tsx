import { useEffect, useRef, useState } from "react";
import { api, type ChatMessage } from "../lib/tauri-bindings";

interface Props {
  instanceId: string;
}

interface UiTurn extends ChatMessage {
  toolsUsed?: string[];
  error?: boolean;
}

export function ObserveChat({ instanceId }: Props) {
  const [turns, setTurns] = useState<UiTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, sending]);

  // Reset the conversation when the operator switches to a different instance.
  useEffect(() => {
    setTurns([]);
    setInput("");
  }, [instanceId]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const history: ChatMessage[] = turns.map(({ role, content }) => ({
      role,
      content,
    }));
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const res = await api.chatAboutInstance(instanceId, history, text);
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          toolsUsed: res.tools_used,
        },
      ]);
    } catch (e) {
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: String(e), error: true },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-[11px] text-neutral-500 mb-3 leading-relaxed">
        A read-only window into this instance. The LLM uses tools to consult
        actual files (state, episodic, stimuli, drift metrics). It speaks in
        the third person and says when something isn't there — it does{" "}
        <em>not</em> claim to be the organism.
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto border border-neutral-800 rounded p-3 mb-3 bg-neutral-900/30"
      >
        {turns.length === 0 && (
          <div className="text-sm text-neutral-600 italic">
            Frag z.B. „woran arbeitet das System gerade?" oder „warum ist Loop
            12 fehlgeschlagen?"
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="mb-4 last:mb-1">
            <div
              className={`text-[10px] uppercase tracking-wide mb-1 ${
                t.role === "user"
                  ? "text-neutral-500"
                  : t.error
                    ? "text-red-400"
                    : "text-emerald-400"
              }`}
            >
              {t.role === "user" ? "operator" : t.error ? "error" : "window"}
            </div>
            <div
              className={`text-sm whitespace-pre-wrap leading-relaxed ${
                t.error ? "text-red-300" : "text-neutral-200"
              }`}
            >
              {t.content}
            </div>
            {t.toolsUsed && t.toolsUsed.length > 0 && (
              <div className="text-[10px] text-neutral-500 mt-1 font-mono">
                tools: {t.toolsUsed.join(", ")}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="text-[11px] text-neutral-500 italic">consulting telemetry…</div>
        )}
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          placeholder="Frage zum aktuellen Zustand der Instanz… (⌘↵ zum Senden)"
          className="flex-1 bg-neutral-800 text-neutral-100 text-sm rounded px-3 py-2 border border-neutral-700 placeholder-neutral-600 resize-y font-mono"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="px-3 py-2 text-xs bg-emerald-300 text-emerald-950 rounded hover:bg-emerald-200 disabled:opacity-50 self-stretch"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
