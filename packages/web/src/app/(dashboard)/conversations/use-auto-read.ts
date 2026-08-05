'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './use-chat';
import { stripMarkdownForSpeech, type useSpeechReader } from './use-speech-reader';

const AUTO_READ_STORAGE_KEY = 'clawix_auto_read';

/**
 * Persists an "auto-read replies aloud" preference and speaks each newly-arrived
 * assistant message via `speechReader` while it's on. Switching to a different
 * (already-loaded) session establishes a silent baseline instead of reading its
 * history aloud — only messages that arrive *after* that count as new.
 */
export function useAutoRead(
  messages: ChatMessage[],
  loading: boolean,
  speechReader: ReturnType<typeof useSpeechReader>,
) {
  const [autoRead, setAutoRead] = useState(false);
  const lastSpokenIdRef = useRef<string | null>(null);
  const baselineEstablishedRef = useRef(false);

  useEffect(() => {
    try {
      setAutoRead(window.localStorage.getItem(AUTO_READ_STORAGE_KEY) === '1');
    } catch {
      // localStorage may be unavailable (private mode); default to off.
    }
  }, []);

  const toggleAutoRead = useCallback(() => {
    setAutoRead((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(AUTO_READ_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // localStorage may be unavailable (private mode); preference just won't persist.
      }
      if (!next) speechReader.stop();
      return next;
    });
  }, [speechReader]);

  useEffect(() => {
    if (loading) {
      baselineEstablishedRef.current = false;
      return;
    }
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && m.content.trim().length > 0);

    if (!baselineEstablishedRef.current) {
      baselineEstablishedRef.current = true;
      lastSpokenIdRef.current = lastAssistant?.id ?? null;
      return;
    }
    if (!autoRead || !lastAssistant || lastAssistant.id === lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = lastAssistant.id;
    speechReader.speak(lastAssistant.id, stripMarkdownForSpeech(lastAssistant.content));
  }, [messages, loading, autoRead, speechReader]);

  return { autoRead, toggleAutoRead };
}
