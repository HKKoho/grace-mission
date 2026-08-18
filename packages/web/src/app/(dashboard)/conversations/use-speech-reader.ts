'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';

const SYNTHESIS_LANG: Record<string, string> = {
  en: 'en-US',
  'zh-TW': 'zh-TW',
};

/** Strips markdown syntax so headings/asterisks/code fences aren't read aloud literally. */
export function stripMarkdownForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

/** Client-side read-aloud via the browser's native Web Speech API — no server round-trip. */
export function useSpeechReader() {
  const { lang } = useLanguage();
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    // speechSynthesis is a single global queue — cancelling first gives free
    // exclusivity across every caller (manual button + auto-read effect).
    window.speechSynthesis.cancel();
    const trimmed = text.trim();
    if (!trimmed) {
      setSpeakingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = SYNTHESIS_LANG[langRef.current] ?? 'en-US';
    utterance.onstart = () => {
      setSpeakingId(id);
    };
    utterance.onend = () => {
      setSpeakingId((current) => (current === id ? null : current));
    };
    utterance.onerror = () => {
      setSpeakingId((current) => (current === id ? null : current));
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  // Stop any in-flight speech on unmount.
  useEffect(() => stop, [stop]);

  return { supported, speakingId, speak, stop };
}
