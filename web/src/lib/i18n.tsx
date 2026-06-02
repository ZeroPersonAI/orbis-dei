// English-only text layer. `t(s)` returns its English source string (with
// optional `{param}` interpolation). The indirection is kept so components can
// stay declarative; there is a single language.
import { createContext, useCallback, useContext, type ReactNode } from "react";

export type Locale = "en";
export type TParams = Record<string, string | number>;

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (s: string, params?: TParams) => string;
}

const I18nContext = createContext<Ctx | null>(null);

function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  let out = s;
  for (const [k, v] of Object.entries(params)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const t = useCallback((s: string, params?: TParams) => interpolate(s, params), []);
  return (
    <I18nContext.Provider value={{ locale: "en", setLocale: () => {}, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside <I18nProvider>");
  return ctx;
}
