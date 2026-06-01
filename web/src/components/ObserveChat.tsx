import { useEffect, useRef, useState } from "react";
import { api, type ChatMessage } from "../lib/tauri-bindings";
import { useT } from "../lib/i18n";

interface Props {
  instanceId: string;
}

interface UiTurn extends ChatMessage {
  toolsUsed?: string[];
  error?: boolean;
}

export function ObserveChat({ instanceId }: Props) {
  const { t, locale } = useT();
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
      const res = await api.chatAboutInstance(instanceId, history, text, locale);
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
        {t(
          "A read-only window into this instance. The LLM uses tools to consult " +
            "actual files (state, episodic, stimuli, drift metrics). It speaks in " +
            "the third person and says when something isn't there — it does",
        )}{" "}
        <em>{t("not")}</em> {t("claim to be the organism.")}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto border border-neutral-800 rounded p-3 mb-3 bg-neutral-900/30"
      >
        {turns.length === 0 && (
          <div className="text-sm text-neutral-600 italic">
            {t(
              "Ask e.g. “what is the system working on right now?” or " +
                "“why did loop 12 fail?”",
            )}
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="mb-4 last:mb-1">
            <div
              className={`text-[10px] uppercase tracking-wide mb-1 ${
                turn.role === "user"
                  ? "text-neutral-500"
                  : turn.error
                    ? "text-red-400"
                    : "text-emerald-400"
              }`}
            >
              {turn.role === "user"
                ? t("operator")
                : turn.error
                  ? t("error")
                  : t("window")}
            </div>
            <div
              className={`text-sm whitespace-pre-wrap leading-relaxed ${
                turn.error ? "text-red-300" : "text-neutral-200"
              }`}
            >
              {turn.content}
            </div>
            {turn.toolsUsed && turn.toolsUsed.length > 0 && (
              <div className="text-[10px] text-neutral-500 mt-1 font-mono">
                {t("tools:")} {turn.toolsUsed.join(", ")}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="text-[11px] text-neutral-500 italic">{t("consulting telemetry…")}</div>
        )}
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          placeholder={t("Question about the instance's current state… (⌘↵ to send)")}
          className="flex-1 bg-neutral-800 text-neutral-100 text-sm rounded px-3 py-2 border border-neutral-700 placeholder-neutral-600 resize-y font-mono"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="px-3 py-2 text-xs bg-emerald-300 text-emerald-950 rounded hover:bg-emerald-200 disabled:opacity-50 self-stretch"
        >
          {sending ? "…" : t("Send")}
        </button>
      </div>
    </div>
  );
}
