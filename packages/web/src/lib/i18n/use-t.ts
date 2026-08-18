'use client';

import { useMemo } from 'react';
import { useLanguage } from './language-provider';

/**
 * A translation dictionary co-located with a page/component. Each leaf may be a
 * string or a function (for interpolation, e.g. `(n) => \`Welcome ${n}\``).
 * The `zh-TW` tree may be partial — any missing leaf falls back to English.
 */
export interface Messages<T> {
  en: T;
  'zh-TW': DeepPartial<T>;
}

export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value !== 'function'
  );
}

/** Deep-merge `override` onto `base`, so untranslated keys keep the English value. */
function mergeFallback<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (override === undefined || override === null) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    out[key] = mergeFallback(
      (base as Record<string, unknown>)[key],
      (override as Record<string, unknown>)[key] as never,
    );
  }
  return out as T;
}

/**
 * Returns the active-language strings for a co-located message dictionary,
 * with per-key English fallback. Usage:
 *
 *   const t = useT(messages);
 *   <h1>{t.title}</h1>
 */
export function useT<T>(messages: Messages<T>): T {
  const { lang } = useLanguage();
  return useMemo(
    () => (lang === 'en' ? messages.en : mergeFallback(messages.en, messages['zh-TW'])),
    [messages, lang],
  );
}
