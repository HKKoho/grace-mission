'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'en' | 'zh-TW';

const STORAGE_KEY = 'clawix_lang';
const SUPPORTED: readonly Lang[] = ['en', 'zh-TW'];

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored as Lang)) return stored as Lang;
    // Fall back to the browser preference for Chinese locales on first visit.
    if (window.navigator.language?.toLowerCase().startsWith('zh')) return 'zh-TW';
  } catch {
    // localStorage may be unavailable (private mode); default to English.
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always start at 'en' on the server and first client render to avoid a
  // hydration mismatch; the stored preference is applied in the effect below.
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const initial = readInitialLang();
    if (initial !== 'en') setLangState(initial);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore persistence failures.
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'zh-TW' : 'en');
  }, [lang, setLang]);

  const value = useMemo(() => ({ lang, setLang, toggleLang }), [lang, setLang, toggleLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
