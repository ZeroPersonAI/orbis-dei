// Optional read-only conversational bot with an inline "inject as stimulus"
// button. Long-polls getUpdates, routes
// text through the same chat-over-telemetry path as the Observe tab, and is
// gated by telegram_enabled + a token in the secret store. Bails out cheaply
// when disabled, so spawnTelegram() is always safe to call at boot.
import type { AppState } from "./state.ts";
import { loadSettings, type Settings } from "./persistence/settings.ts";
import { chatAboutInstance, type ChatMessage } from "./core/chat.ts";
import { injectStimulus } from "./core/stimulus.ts";

const POLL_TIMEOUT_SECS = 30;
const MAX_HISTORY_PER_CHAT = 12;
const MAX_TELEGRAM_TEXT = 4000;
const PENDING_CAP = 50;
const PENDING_TTL_MS = 3600 * 1000;
const TITLE_MAX_CHARS = 60;
const CB_STIM_INJECT = "stim_inject";

interface PendingEntry {
  chatId: number;
  botMsgId: number;
  originalText: string;
  insertedAt: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function spawnTelegram(state: AppState): void {
  void runLoop(state).catch((e) => console.error("telegram bot exited with error:", e));
}

async function runLoop(state: AppState): Promise<void> {
  const initial = loadSettings(state.db);
  if (!initial.telegram_enabled) return;

  const token = state.secrets.get("telegram-bot-token");
  if (!token) {
    console.warn("telegram_enabled but no token — bot will not start");
    return;
  }
  const base = `https://api.telegram.org/bot${token}`;
  console.log("telegram bot starting");

  const history = new Map<number, ChatMessage[]>();
  let pending: PendingEntry[] = [];
  let offset = 0;

  for (;;) {
    const settings = loadSettings(state.db);
    if (!settings.telegram_enabled) {
      console.log("telegram bot stopping — disabled in settings");
      return;
    }
    const defaultInstance = settings.telegram_default_instance;
    if (!defaultInstance) {
      await sleep(15000);
      continue;
    }

    pending = prunePending(pending);

    let updates: any[];
    try {
      const r = await fetch(`${base}/getUpdates?offset=${offset}&timeout=${POLL_TIMEOUT_SECS}`, {
        signal: AbortSignal.timeout((POLL_TIMEOUT_SECS + 10) * 1000),
      });
      const j: any = await r.json();
      if (!j?.ok) {
        await sleep(2000);
        continue;
      }
      updates = j.result ?? [];
    } catch (e) {
      // Network/parse error. Retry after a pause, but log it — a persistent
      // misconfiguration would otherwise make the bot freeze silently.
      console.warn("telegram getUpdates failed, retrying:", e instanceof Error ? e.message : e);
      await sleep(2000);
      continue;
    }

    for (const u of updates) {
      if (typeof u?.update_id === "number") offset = u.update_id + 1; // guard against NaN offset

      if (u.callback_query) {
        await handleCallback(state, base, settings, defaultInstance, pending, u.callback_query);
        continue;
      }

      const msg = u.message;
      const text: string | undefined = msg?.text;
      if (!msg || typeof text !== "string") continue;
      const chatId: number = msg.chat.id;

      if (!isAuthorized(settings, chatId)) {
        await sendMessage(
          base,
          chatId,
          "(This chat ID is not authorized. Add it first in the app settings.)",
          false,
        );
        continue;
      }

      const prior = history.get(chatId) ?? [];
      let reply: string;
      try {
        const turn = await chatAboutInstance(state, defaultInstance, prior, text);
        reply = turn.reply;
      } catch (e: any) {
        reply = `(orbis-dei error) ${e?.message ?? e}`;
      }

      const entry = history.get(chatId) ?? [];
      entry.push({ role: "user", content: text });
      entry.push({ role: "assistant", content: reply });
      if (entry.length > MAX_HISTORY_PER_CHAT) entry.splice(0, entry.length - MAX_HISTORY_PER_CHAT);
      history.set(chatId, entry);

      const withButton = settings.telegram_allow_stimulus_inject;
      const botMsgId = await sendMessage(base, chatId, reply, withButton);
      if (botMsgId !== null && withButton) {
        pending.push({ chatId, botMsgId, originalText: text, insertedAt: Date.now() });
        while (pending.length > PENDING_CAP) pending.shift();
      }
    }
  }
}

function isAuthorized(settings: Settings, chatId: number): boolean {
  return settings.telegram_authorized_chats.includes(String(chatId));
}

function prunePending(pending: PendingEntry[]): PendingEntry[] {
  const now = Date.now();
  return pending.filter((e) => now - e.insertedAt <= PENDING_TTL_MS);
}

async function handleCallback(
  state: AppState,
  base: string,
  settings: Settings,
  defaultInstance: string,
  pending: PendingEntry[],
  cb: any,
): Promise<void> {
  const cbId: string = cb.id;
  const data: string | undefined = cb.data;
  const msg = cb.message;
  if (!data || !msg) {
    await answerCallback(base, cbId, null, false);
    return;
  }
  const chatId: number = msg.chat.id;
  const botMsgId: number = msg.message_id;

  if (!isAuthorized(settings, chatId)) {
    await answerCallback(base, cbId, "Unauthorized", true);
    return;
  }
  if (!settings.telegram_allow_stimulus_inject) {
    await answerCallback(base, cbId, "Stimulus-Inject is disabled", true);
    return;
  }
  if (data !== CB_STIM_INJECT) {
    await answerCallback(base, cbId, null, false);
    return;
  }

  const idx = pending.findIndex((e) => e.chatId === chatId && e.botMsgId === botMsgId);
  if (idx < 0) {
    await answerCallback(base, cbId, "Button expired", true);
    await editRemoveKeyboard(base, chatId, botMsgId);
    return;
  }
  const [entry] = pending.splice(idx, 1);
  const title = deriveTitle(entry.originalText);

  await editRemoveKeyboard(base, chatId, botMsgId);
  try {
    const rel = injectStimulus(state, defaultInstance, "discrete", title, entry.originalText, null);
    await answerCallback(base, cbId, "Injected", false);
    await sendMessage(base, chatId, `✓ Injected → ${rel}`, false);
  } catch (e: any) {
    await answerCallback(base, cbId, `Error: ${e?.message ?? e}`, true);
  }
}

function deriveTitle(body: string): string {
  const firstLine = body.trim().split("\n")[0]?.trim() ?? "";
  if (firstLine.length === 0) return "Telegram stimulus";
  const chars = [...firstLine];
  if (chars.length <= TITLE_MAX_CHARS) return firstLine;
  return chars.slice(0, TITLE_MAX_CHARS).join("") + "…";
}

async function sendMessage(
  base: string,
  chatId: number,
  text: string,
  withButton: boolean,
): Promise<number | null> {
  const chars = [...text];
  const truncated =
    chars.length > MAX_TELEGRAM_TEXT
      ? chars.slice(0, MAX_TELEGRAM_TEXT).join("") + "\n…[truncated]"
      : text;
  const payload: any = { chat_id: chatId, text: truncated };
  if (withButton) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: "📨 Inject as stimulus", callback_data: CB_STIM_INJECT }]],
    };
  }
  try {
    const r = await fetch(`${base}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    return j?.result?.message_id ?? null;
  } catch {
    return null;
  }
}

async function editRemoveKeyboard(base: string, chatId: number, messageId: number): Promise<void> {
  try {
    await fetch(`${base}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
    });
  } catch {
    /* best-effort */
  }
}

async function answerCallback(
  base: string,
  callbackId: string,
  text: string | null,
  showAlert: boolean,
): Promise<void> {
  const payload: any = { callback_query_id: callbackId, show_alert: showAlert };
  if (text !== null) payload.text = text;
  try {
    await fetch(`${base}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* best-effort */
  }
}
