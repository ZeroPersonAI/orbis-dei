import { useEffect, useState } from "react";
import {
  api,
  ROUTING_MODE_LABELS,
  type Instance,
  type RoutingMode,
  type Settings,
} from "../lib/tauri-bindings";
import { useT } from "../lib/i18n";

interface Props {
  onBack: () => void;
}

export function SettingsView({ onBack }: Props) {
  const { t } = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [newKey, setNewKey] = useState("");
  const [hasOpenai, setHasOpenai] = useState<boolean | null>(null);
  const [newOpenaiKey, setNewOpenaiKey] = useState("");
  const [hasGemini, setHasGemini] = useState<boolean | null>(null);
  const [newGeminiKey, setNewGeminiKey] = useState("");
  const [hasTelegram, setHasTelegram] = useState<boolean | null>(null);
  const [newTelegramToken, setNewTelegramToken] = useState("");
  const [instances, setInstances] = useState<Instance[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    try {
      const [s, k, oa, gm, t, inst] = await Promise.all([
        api.getSettings(),
        api.hasAnthropicKey(),
        api.hasOpenaiKey(),
        api.hasGeminiKey(),
        api.hasTelegramToken(),
        api.listInstances(),
      ]);
      setSettings(s);
      setHasKey(k);
      setHasOpenai(oa);
      setHasGemini(gm);
      setHasTelegram(t);
      setInstances(inst);
    } catch (e) {
      setError(String(e));
    }
  }

  async function saveTelegramToken() {
    if (!newTelegramToken.trim()) return;
    try {
      await api.setTelegramToken(newTelegramToken.trim());
      setNewTelegramToken("");
      setHasTelegram(true);
      setNotice(t("Telegram token saved."));
    } catch (e) {
      setError(String(e));
    }
  }

  async function clearTelegramToken() {
    try {
      await api.clearTelegramToken();
      setHasTelegram(false);
      setNotice(t("Telegram token cleared."));
    } catch (e) {
      setError(String(e));
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.updateSettings({
        anthropic_model: settings.anthropic_model,
        anthropic_base_url: settings.anthropic_base_url,
        openai_model: settings.openai_model,
        openai_base_url: settings.openai_base_url,
        gemini_model: settings.gemini_model,
        gemini_base_url: settings.gemini_base_url,
        default_routing_mode: settings.default_routing_mode,
        governor_rpm: settings.governor_rpm,
        governor_itpm: settings.governor_itpm,
        governor_otpm: settings.governor_otpm,
        max_concurrent_daemons: settings.max_concurrent_daemons,
        boredom_threshold: settings.boredom_threshold,
        allow_tool_execution: settings.allow_tool_execution,
        network_access: settings.network_access,
        network_allowlist: settings.network_allowlist,
        telegram_enabled: settings.telegram_enabled,
        telegram_default_instance: settings.telegram_default_instance,
        telegram_authorized_chats: settings.telegram_authorized_chats,
        telegram_allow_stimulus_inject: settings.telegram_allow_stimulus_inject,
      });
      setSettings(updated);
      setNotice(t("Settings saved."));
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveOpenaiKey() {
    if (!newOpenaiKey.trim()) return;
    try {
      await api.setOpenaiKey(newOpenaiKey.trim());
      setNewOpenaiKey("");
      setHasOpenai(true);
      setNotice(t("OpenAI key saved."));
    } catch (e) {
      setError(String(e));
    }
  }

  async function clearOpenaiKey() {
    try {
      await api.clearOpenaiKey();
      setHasOpenai(false);
      setNotice(t("OpenAI key cleared."));
    } catch (e) {
      setError(String(e));
    }
  }

  async function saveGeminiKey() {
    if (!newGeminiKey.trim()) return;
    try {
      await api.setGeminiKey(newGeminiKey.trim());
      setNewGeminiKey("");
      setHasGemini(true);
      setNotice(t("Gemini key saved."));
    } catch (e) {
      setError(String(e));
    }
  }

  async function clearGeminiKey() {
    try {
      await api.clearGeminiKey();
      setHasGemini(false);
      setNotice(t("Gemini key cleared."));
    } catch (e) {
      setError(String(e));
    }
  }

  async function saveKey() {
    if (!newKey.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.setAnthropicKey(newKey.trim());
      setNewKey("");
      setHasKey(true);
      setNotice(t("Anthropic key saved."));
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    if (!window.confirm(t("Clear the saved Anthropic API key?"))) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.clearAnthropicKey();
      setHasKey(false);
      setNotice(t("Anthropic key cleared."));
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-neutral-950 text-neutral-100">
      <header className="px-6 py-4 border-b border-neutral-800 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-neutral-400 hover:text-neutral-100 text-sm"
        >
          ← {t("Back")}
        </button>
        <div>
          <h1 className="text-xl font-light tracking-tight">{t("Settings")}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t("App-wide configuration. Secrets are kept in an encrypted file in the data directory.")}
          </p>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 px-3 py-2 bg-red-950 border border-red-900 rounded text-sm text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="mx-6 mt-4 px-3 py-2 bg-emerald-950 border border-emerald-900 rounded text-sm text-emerald-200">
          {notice}
        </div>
      )}

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
        {/* Anthropic API key */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-neutral-300 mb-1">
            {t("Anthropic API key")}
          </h2>
          <p className="text-xs text-neutral-500 mb-3">
            {t("Required when any phase routes to Anthropic. Stored in an encrypted file in the data directory.")}
          </p>

          <div className="text-xs mb-3">
            {t("Status:")}{" "}
            {hasKey === null ? (
              <span className="text-neutral-500">{t("checking…")}</span>
            ) : hasKey ? (
              <span className="text-emerald-400">{t("key saved")}</span>
            ) : (
              <span className="text-amber-400">{t("no key set")}</span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder={hasKey ? t("Enter a new key to replace…") : "sk-ant-…"}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-600"
            />
            <button
              onClick={saveKey}
              disabled={!newKey.trim() || saving}
              className="px-3 py-1.5 text-sm bg-neutral-100 text-neutral-900 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasKey ? t("Replace") : t("Save")}
            </button>
            {hasKey && (
              <button
                onClick={clearKey}
                disabled={saving}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {t("Clear")}
              </button>
            )}
          </div>
        </section>

        {/* OpenAI API key */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-neutral-300 mb-1">
            {t("OpenAI API key")}
          </h2>
          <p className="text-xs text-neutral-500 mb-3">
            {t("Required when any phase routes to OpenAI.")}
          </p>
          <div className="text-xs mb-3">
            {t("Status:")}{" "}
            {hasOpenai === null ? (
              <span className="text-neutral-500">{t("checking…")}</span>
            ) : hasOpenai ? (
              <span className="text-emerald-400">{t("key saved")}</span>
            ) : (
              <span className="text-amber-400">{t("no key set")}</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={newOpenaiKey}
              onChange={(e) => setNewOpenaiKey(e.target.value)}
              placeholder={hasOpenai ? t("Enter a new key to replace…") : "sk-…"}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-600"
            />
            <button
              onClick={saveOpenaiKey}
              disabled={!newOpenaiKey.trim() || saving}
              className="px-3 py-1.5 text-sm bg-neutral-100 text-neutral-900 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasOpenai ? t("Replace") : t("Save")}
            </button>
            {hasOpenai && (
              <button
                onClick={clearOpenaiKey}
                disabled={saving}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {t("Clear")}
              </button>
            )}
          </div>
        </section>

        {/* Gemini API key */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-neutral-300 mb-1">
            {t("Gemini API key")}
          </h2>
          <p className="text-xs text-neutral-500 mb-3">
            {t("Required when any phase routes to Gemini.")}
          </p>
          <div className="text-xs mb-3">
            {t("Status:")}{" "}
            {hasGemini === null ? (
              <span className="text-neutral-500">{t("checking…")}</span>
            ) : hasGemini ? (
              <span className="text-emerald-400">{t("key saved")}</span>
            ) : (
              <span className="text-amber-400">{t("no key set")}</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={newGeminiKey}
              onChange={(e) => setNewGeminiKey(e.target.value)}
              placeholder={hasGemini ? t("Enter a new key to replace…") : "AIza…"}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-600"
            />
            <button
              onClick={saveGeminiKey}
              disabled={!newGeminiKey.trim() || saving}
              className="px-3 py-1.5 text-sm bg-neutral-100 text-neutral-900 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasGemini ? t("Replace") : t("Save")}
            </button>
            {hasGemini && (
              <button
                onClick={clearGeminiKey}
                disabled={saving}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {t("Clear")}
              </button>
            )}
          </div>
        </section>

        {settings && (
          <>
            {/* Models & endpoints */}
            <section className="space-y-5 mb-10">
              <h2 className="text-sm font-medium text-neutral-300">
                {t("Models & endpoints")}
              </h2>

              <Field
                label={t("Anthropic model")}
                value={settings.anthropic_model}
                mono
                onChange={(v) =>
                  setSettings({ ...settings, anthropic_model: v })
                }
              />
              <Field
                label={t("Anthropic base URL")}
                value={settings.anthropic_base_url}
                mono
                onChange={(v) =>
                  setSettings({ ...settings, anthropic_base_url: v })
                }
              />
              <Field
                label={t("OpenAI model")}
                value={settings.openai_model}
                mono
                onChange={(v) => setSettings({ ...settings, openai_model: v })}
              />
              <Field
                label={t("OpenAI base URL")}
                value={settings.openai_base_url}
                mono
                onChange={(v) =>
                  setSettings({ ...settings, openai_base_url: v })
                }
              />
              <Field
                label={t("Gemini model")}
                value={settings.gemini_model}
                mono
                onChange={(v) => setSettings({ ...settings, gemini_model: v })}
              />
              <Field
                label={t("Gemini base URL (OpenAI-compatible)")}
                value={settings.gemini_base_url}
                mono
                onChange={(v) =>
                  setSettings({ ...settings, gemini_base_url: v })
                }
              />

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  {t("Default routing mode (for new instances)")}
                </label>
                <select
                  value={settings.default_routing_mode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_routing_mode: e.target.value,
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                >
                  {(
                    Object.entries(ROUTING_MODE_LABELS) as Array<
                      [RoutingMode, string]
                    >
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* Governor */}
            <section className="space-y-5 mb-10">
              <h2 className="text-sm font-medium text-neutral-300">
                {t("Governor — rate limits")}
              </h2>
              <p className="text-xs text-neutral-500">
                {t(
                  "Applies to Anthropic calls only. Adjust to match your Anthropic console tier; conservative Tier-1 defaults are pre-filled.",
                )}
              </p>

              <div className="grid grid-cols-3 gap-3">
                <NumberField
                  label={t("RPM")}
                  value={settings.governor_rpm}
                  onChange={(v) =>
                    setSettings({ ...settings, governor_rpm: v })
                  }
                />
                <NumberField
                  label={t("Input TPM")}
                  value={settings.governor_itpm}
                  onChange={(v) =>
                    setSettings({ ...settings, governor_itpm: v })
                  }
                />
                <NumberField
                  label={t("Output TPM")}
                  value={settings.governor_otpm}
                  onChange={(v) =>
                    setSettings({ ...settings, governor_otpm: v })
                  }
                />
              </div>
            </section>

            {/* Daemon */}
            <section className="space-y-5 mb-10">
              <h2 className="text-sm font-medium text-neutral-300">{t("Daemon")}</h2>
              <p className="text-xs text-neutral-500">
                {t("Controls continuous-loop mode per instance.")}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label={t("Max concurrent daemons")}
                  value={settings.max_concurrent_daemons}
                  onChange={(v) =>
                    setSettings({ ...settings, max_concurrent_daemons: v })
                  }
                />
                <NumberField
                  label={t("Boredom threshold (loops without stimulus)")}
                  value={settings.boredom_threshold}
                  onChange={(v) =>
                    setSettings({ ...settings, boredom_threshold: v })
                  }
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs text-neutral-400">
                  <input
                    type="checkbox"
                    checked={settings.allow_tool_execution}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        allow_tool_execution: e.target.checked,
                      })
                    }
                    className="accent-red-400"
                  />
                  {t("Allow tool execution in the Expand phase")}
                </label>
                <p className="text-[10px] text-amber-500/80 mt-1 leading-relaxed">
                  {t(
                    "Runs model-generated shell scripts in a macOS sandbox-exec jail — network denied (unless changed below), writes confined to the instance directory, 30s timeout. Residual risk remains; a determined exploit could still find gaps. When off, tools are still written to disk but not executed.",
                  )}
                </p>
              </div>

              <div className="space-y-2 border-t border-neutral-800 pt-4">
                <label className="block text-xs text-neutral-400 mb-1.5">
                  {t("Network access (sandbox firewall)")}
                </label>
                <select
                  value={settings.network_access}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      network_access: e.target.value as
                        | "off"
                        | "gated"
                        | "open",
                    })
                  }
                  className="w-full bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1.5 border border-neutral-700"
                >
                  <option value="off">{t("off — fully isolated (default)")}</option>
                  <option value="gated">
                    {t("gated — TCP 80/443 to allowlisted hosts")}
                  </option>
                  <option value="open">
                    {t("open — sandbox firewall disabled, all network allowed")}
                  </option>
                </select>

                {settings.network_access === "gated" && (
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">
                      {t("Allowlist (one hostname per line, no scheme, no path)")}
                    </label>
                    <textarea
                      value={settings.network_allowlist.join("\n")}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          network_allowlist: e.target.value
                            .split("\n")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0),
                        })
                      }
                      rows={4}
                      placeholder={"wikipedia.org\narxiv.org"}
                      className="w-full bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1.5 border border-neutral-700 placeholder-neutral-600 font-mono"
                    />
                  </div>
                )}

                {settings.network_access === "open" && (
                  <p className="text-[10px] text-red-400/90 leading-relaxed">
                    {t(
                      "Open mode bypasses the sandbox firewall entirely. The InstanceView shows a red banner each loop and an SP-I warning is appended to every review file while this is active — use it for explicit exploration, not as a default.",
                    )}
                  </p>
                )}
                {settings.network_access === "gated" && (
                  <p className="text-[10px] text-amber-400/80 leading-relaxed">
                    {t(
                      "Tools can reach the allowlisted hosts on http/https. DNS is open. Per-tool approval is deferred — the allowlist is the primary defense.",
                    )}
                  </p>
                )}
              </div>
            </section>

            <section className="space-y-3 border-t border-neutral-800 pt-4">
              <h2 className="text-sm text-neutral-300">{t("Telegram bot (read-only)")}</h2>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                {t(
                  "Talk to one instance from your phone. The bot answers from real telemetry — same window-not-voice rule as the Observe tab. App restart needed when you change these.",
                )}
              </p>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  {t("Telegram bot token")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={newTelegramToken}
                    onChange={(e) => setNewTelegramToken(e.target.value)}
                    placeholder={
                      hasTelegram ? t("(token saved)") : "1234567:abcd…"
                    }
                    className="flex-1 bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1.5 border border-neutral-700 placeholder-neutral-600 font-mono"
                  />
                  <button
                    onClick={saveTelegramToken}
                    disabled={!newTelegramToken.trim()}
                    className="px-3 py-1.5 text-xs bg-neutral-200 text-neutral-900 rounded hover:bg-white disabled:opacity-50"
                  >
                    {t("Save token")}
                  </button>
                  {hasTelegram && (
                    <button
                      onClick={clearTelegramToken}
                      className="text-[10px] text-neutral-500 hover:text-red-400"
                    >
                      {t("clear")}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">
                  {t("Token comes from @BotFather, stored in the encrypted secret store.")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="tg-enabled"
                  type="checkbox"
                  checked={settings.telegram_enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      telegram_enabled: e.target.checked,
                    })
                  }
                  className="accent-emerald-400"
                />
                <label
                  htmlFor="tg-enabled"
                  className="text-xs text-neutral-300"
                >
                  {t("Spawn bot on app start")}
                </label>
              </div>

              {settings.telegram_enabled && (
                <>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">
                      {t("Default instance (the one the bot speaks through)")}
                    </label>
                    <select
                      value={settings.telegram_default_instance ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          telegram_default_instance: e.target.value || null,
                        })
                      }
                      className="w-full bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1.5 border border-neutral-700"
                    >
                      <option value="">{t("(none selected)")}</option>
                      {instances.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} — {i.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="tg-stim"
                      type="checkbox"
                      checked={settings.telegram_allow_stimulus_inject}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          telegram_allow_stimulus_inject: e.target.checked,
                        })
                      }
                      className="accent-emerald-400"
                    />
                    <label
                      htmlFor="tg-stim"
                      className="text-xs text-neutral-300"
                    >
                      {t("Allow stimulus injection via inline button")}
                    </label>
                  </div>
                  {settings.telegram_allow_stimulus_inject && (
                    <p className="text-[10px] text-neutral-500 leading-relaxed">
                      {t(
                        "After every bot reply a “📨 Inject as stimulus” button appears. Click → the original message lands as a discrete stimulus in the default instance's inbox (resetting the boredom counter).",
                      )}
                    </p>
                  )}

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">
                      {t(
                        "Authorized Telegram chat IDs (one per line, may be negative for groups)",
                      )}
                    </label>
                    <textarea
                      value={settings.telegram_authorized_chats.join("\n")}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          telegram_authorized_chats: e.target.value
                            .split("\n")
                            .map((s) => s.trim())
                            .filter((s) => /^-?\d+$/.test(s)),
                        })
                      }
                      rows={3}
                      placeholder={"123456789\n-100987654321"}
                      className="w-full bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1.5 border border-neutral-700 placeholder-neutral-600 font-mono"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">
                      {t("Send your bot")} „<code>/start</code>"{" "}
                      {t("and read its `update.message.chat.id` — e.g. via")}{" "}
                      <code>@RawDataBot</code>. {t("Only listed IDs get a reply.")}
                    </p>
                  </div>
                </>
              )}
            </section>

            <div className="pt-3">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-4 py-1.5 text-sm bg-neutral-100 text-neutral-900 rounded hover:bg-white disabled:opacity-50"
              >
                {saving ? t("Saving…") : t("Save changes")}
              </button>
            </div>
          </>
        )}
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  onChange,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600 ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1.5">{label}</label>
      <input
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-600"
      />
    </div>
  );
}
