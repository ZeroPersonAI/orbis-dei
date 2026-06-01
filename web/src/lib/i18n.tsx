// Lightweight gettext-style i18n. The English source string IS the key, so
// components wrap user-facing text as `t("Pause")`; missing translations fall
// back to English. Locale defaults to English and is persisted to localStorage.
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import de from "./locales/de";
import zh from "./locales/zh";
import es from "./locales/es";
import fr from "./locales/fr";

export type Locale = "en" | "de" | "zh" | "es" | "fr";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

const DICTS: Record<Locale, Record<string, string>> = { en: {}, de, zh, es, fr };
const STORAGE_KEY = "orbis_locale";

export type TParams = Record<string, string | number>;

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (s: string, params?: TParams) => string;
}

const I18nContext = createContext<Ctx | null>(null);

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ["en", "de", "zh", "es", "fr"].includes(saved)) return saved as Locale;
  } catch {
    /* localStorage unavailable */
  }
  return "en";
}

function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  let out = s;
  for (const [k, v] of Object.entries(params)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (s: string, params?: TParams) => {
      const translated = locale === "en" ? s : (DICTS[locale][s] ?? s);
      return interpolate(translated, params);
    },
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useT(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside <I18nProvider>");
  return ctx;
}

/** A compact language dropdown. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useT();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={
        className ||
        "bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-300 px-2 py-1"
      }
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
