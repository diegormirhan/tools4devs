import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { portuguese } from "./pt";

export type Language = "en" | "pt";

const STORAGE_KEY = "tools4devs.language";

/**
 * Translations are keyed by the English sentence itself.
 *
 * The alternative is a key per string — `settings.theme.title` — which means
 * inventing and maintaining four hundred names, and reading code that no
 * longer says what it puts on the screen. Keying by the English means the
 * source is legible, English needs no lookup at all, and a missing
 * translation shows the original rather than a key. A test keeps the
 * dictionary honest: every string the app can show has to be in it.
 */
export type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary | null> = {
  en: null,
  pt: portuguese,
};

export type Translate = (text: string, values?: Record<string, string | number>) => string;

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({
  language: "en",
  setLanguage: () => undefined,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => read());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // A storage that refuses to answer costs the preference, not the app.
    }
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** The translator for the language in force, stable while it does not change. */
export function useT(): Translate {
  const { language } = useLanguage();
  return useCallback<Translate>(
    (text, values) => translate(language, text, values),
    [language],
  );
}

export function translate(
  language: Language,
  text: string,
  values?: Record<string, string | number>,
): string {
  const dictionary = dictionaries[language];
  const translated = dictionary?.[text] ?? text;
  if (!values) return translated;
  // {name} rather than a positional %s: the order of the pieces is not the
  // same in every language, and a translator needs to be able to move them.
  return translated.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

function read(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "pt" ? "pt" : "en";
  } catch {
    return "en";
  }
}
