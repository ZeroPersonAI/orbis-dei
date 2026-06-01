import { useEffect, useMemo, useState } from "react";
import { api, type OutboxThread } from "../lib/tauri-bindings";
import { useT } from "../lib/i18n";

interface Props {
  instanceId: string;
  refreshTick: number;
  /** Called after a reply is injected so the parent can refresh instance state. */
  onReplied: () => void;
}

export function Messages({ instanceId, refreshTick, onReplied }: Props) {
  const { t } = useT();
  const [threads, setThreads] = useState<OutboxThread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localTick, setLocalTick] = useState(0);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTitle, setReplyTitle] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listOutboxThreads(instanceId)
      .then((t) => {
        if (cancelled) return;
        setThreads(t);
        setError(null);
        if (t.length > 0 && (selected === null || !t.find((x) => x.name === selected))) {
          setSelected(t[0].name);
        }
        if (t.length === 0) setSelected(null);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, refreshTick, localTick]);

  // Close reply composer when switching threads.
  useEffect(() => {
    setReplyOpen(false);
    setReplyTitle("");
    setReplyBody("");
    setSendError(null);
    setOkMsg(null);
  }, [selected]);

  // Auto-mark-read after a brief dwell time on the selected thread.
  useEffect(() => {
    if (!selected) return;
    const cur = threads.find((t) => t.name === selected);
    if (!cur || cur.read) return;
    const timer = window.setTimeout(() => {
      api
        .markOutboxRead(instanceId, selected)
        .then(() => setLocalTick((t) => t + 1))
        .catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, threads]);

  async function toggleRead() {
    if (!thread) return;
    try {
      if (thread.read) {
        await api.markOutboxUnread(instanceId, thread.name);
      } else {
        await api.markOutboxRead(instanceId, thread.name);
      }
      setLocalTick((t) => t + 1);
    } catch (e) {
      setError(String(e));
    }
  }

  const thread = useMemo(
    () => threads.find((t) => t.name === selected) ?? null,
    [threads, selected],
  );

  function startReply() {
    if (!thread) return;
    const originalTitle = extractTitle(thread.content);
    setReplyTitle(`Re: ${originalTitle}`);
    setReplyBody("");
    setSendError(null);
    setOkMsg(null);
    setReplyOpen(true);
  }

  async function send() {
    if (!thread) return;
    if (!replyBody.trim()) {
      setSendError(t("Reply must not be empty."));
      return;
    }
    const title = replyTitle.trim() || `Re: ${thread.name}`;
    setSending(true);
    setSendError(null);
    try {
      const path = await api.injectStimulus(
        instanceId,
        "discrete",
        title,
        replyBody,
        thread.name,
      );
      setOkMsg(t("Replied → {path}", { path }));
      setReplyOpen(false);
      setReplyTitle("");
      setReplyBody("");
      setLocalTick((t) => t + 1);
      onReplied();
    } catch (e) {
      setSendError(String(e));
    } finally {
      setSending(false);
    }
  }

  if (error) return <div className="text-sm text-red-300">{error}</div>;

  if (threads.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        {t("No messages in")} <code className="text-neutral-400">stimuli/outbox/</code>.{" "}
        {t("The organism writes here when it wants to address you.")}
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Thread list */}
      <div className="w-80 shrink-0 overflow-auto border-r border-neutral-800 pr-3">
        <div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-2">
          {threads.length === 1
            ? t("{count} message", { count: threads.length })
            : t("{count} messages", { count: threads.length })}
        </div>
        {threads.map((thr) => {
          const isSel = thr.name === selected;
          const unreplied = thr.replies.length === 0;
          const unread = !thr.read;
          const titleClass = unread
            ? isSel
              ? "text-emerald-200 font-semibold"
              : "text-neutral-100 font-semibold"
            : isSel
              ? "text-emerald-300"
              : "text-neutral-400";
          return (
            <button
              key={thr.name}
              onClick={() => setSelected(thr.name)}
              className={`block w-full text-left px-2 py-2 mb-0.5 rounded hover:bg-neutral-800 ${
                isSel ? "bg-neutral-800" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    unread ? "bg-sky-400" : "bg-transparent"
                  }`}
                  title={unread ? t("unread") : t("read")}
                />
                <span
                  className={`text-[11px] font-mono truncate flex-1 ${titleClass}`}
                >
                  {extractTitle(thr.content) || thr.name}
                </span>
                {unreplied && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-400"
                    title={t("not yet replied")}
                  />
                )}
                {thr.replies.length > 0 && (
                  <span className="text-[10px] text-neutral-500 font-mono">
                    ↩ {thr.replies.length}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-neutral-500 truncate mt-0.5 font-mono">
                {thr.name} · {fmtTime(thr.modified_at)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Thread detail */}
      <div className="flex-1 overflow-auto min-h-0">
        {thread ? (
          <>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-sm text-neutral-200">
                {extractTitle(thread.content) || thread.name}
              </h2>
              <span className="text-[10px] text-neutral-500 font-mono">
                {thread.name} · {fmtTime(thread.modified_at)}
              </span>
              <button
                onClick={toggleRead}
                className="ml-auto text-[10px] text-neutral-500 hover:text-neutral-200"
                title={
                  thread.read
                    ? t("mark as unread")
                    : t("mark as read")
                }
              >
                {thread.read ? t("● mark unread") : t("○ mark read")}
              </button>
            </div>

            {/* Original message */}
            <div className="border border-neutral-800 rounded p-3 bg-neutral-900/30 mb-3">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1.5">
                {t("Original (from the system)")}
              </div>
              <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {thread.content}
              </pre>
            </div>

            {/* Replies */}
            {thread.replies.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1.5">
                  {t("Replies ({count})", { count: thread.replies.length })}
                </div>
                {thread.replies.map((r) => (
                  <div
                    key={`${r.category}/${r.name}`}
                    className="border border-emerald-900/40 rounded p-3 bg-emerald-950/10 mb-2 last:mb-0"
                  >
                    <div className="text-[10px] text-emerald-400/80 mb-1 font-mono">
                      {r.category}/{r.name} · {fmtTime(r.modified_at)}
                    </div>
                    <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
                      {r.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {/* Reply composer */}
            {replyOpen ? (
              <div className="border border-neutral-700 rounded p-3 bg-neutral-900/60">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-2">
                  {t("Compose reply")}
                </div>
                <input
                  value={replyTitle}
                  onChange={(e) => setReplyTitle(e.target.value)}
                  placeholder={t("Re: …")}
                  className="w-full bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1 border border-neutral-700 placeholder-neutral-600 mb-2"
                />
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={6}
                  placeholder={t("Your reply to the instance…")}
                  className="w-full bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1.5 border border-neutral-700 placeholder-neutral-600 resize-y font-mono"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={send}
                    disabled={sending}
                    className="px-3 py-1 text-[11px] bg-emerald-300 text-emerald-950 rounded hover:bg-emerald-200 disabled:opacity-50"
                  >
                    {sending ? t("Sending…") : t("Send")}
                  </button>
                  <button
                    onClick={() => setReplyOpen(false)}
                    disabled={sending}
                    className="px-3 py-1 text-[11px] text-neutral-400 hover:text-neutral-200"
                  >
                    {t("Cancel")}
                  </button>
                  {sendError && (
                    <span className="text-[11px] text-red-400">{sendError}</span>
                  )}
                </div>
                <div className="text-[10px] text-neutral-500 mt-2">
                  {t("Lands as a stimulus in")} <code>stimuli/inbox/</code> {t("with")}{" "}
                  <code>Reply-To: stimuli/outbox/{thread.name}</code>.
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={startReply}
                  className="px-3 py-1.5 text-xs bg-neutral-100 text-neutral-900 rounded hover:bg-white"
                >
                  ↩ {t("Reply")}
                </button>
                {okMsg && (
                  <span className="text-[11px] text-emerald-400 font-mono break-all">
                    {okMsg}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-neutral-600">{t("Select a message.")}</div>
        )}
      </div>
    </div>
  );
}

function extractTitle(content: string): string {
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("# ")) return line.slice(2).trim();
  }
  return "";
}

function fmtTime(rfc: string): string {
  if (!rfc) return "";
  return rfc.slice(0, 19).replace("T", " ");
}
