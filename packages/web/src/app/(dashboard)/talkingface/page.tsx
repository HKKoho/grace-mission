'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, Volume2 } from 'lucide-react';
import { useT, type Messages } from '@/lib/i18n';
import { authFetch } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AvatarStage3D,
  type AvatarStageHandle,
} from '@/components/dashboard/talkingface/AvatarStage3D';

interface ApiAgent {
  id: string;
  name: string;
  isActive: boolean;
}

interface PaginatedAgents {
  data: ApiAgent[];
}

interface TalkingFaceSpeakResponse {
  text: string;
  sessionId: string | null;
  audio: string;
  words: string[];
  wtimes: number[];
  wdurations: number[];
}

const messages = {
  en: {
    title: 'Talking Face',
    subtitle: 'agent-driven avatar speech — Milestone 2',
    description:
      'Type a line and the active agent replies out loud through a self-hosted Piper voice.',
    speak: 'Test speak',
    placeholder: 'Say something…',
    send: 'Send',
    noAgent: 'No active agent found — create one in Agents before using this page.',
    loadError: (m: string) => `Failed to load avatar: ${m}`,
    speakError: (m: string) => `Failed to get a reply: ${m}`,
  },
  'zh-TW': {
    title: '會說話的臉',
    subtitle: '代理驅動的虛擬形象發聲 — 第二階段',
    description: '輸入一句話，啟用中的代理會透過自架的 Piper 語音朗讀回覆。',
    speak: '測試發聲',
    placeholder: '輸入訊息…',
    send: '傳送',
    noAgent: '找不到啟用中的代理——請先在「代理」頁面建立一個。',
    loadError: (m: string) => `虛擬形象載入失敗：${m}`,
    speakError: (m: string) => `無法取得回覆：${m}`,
  },
} satisfies Messages<{
  title: string;
  subtitle: string;
  description: string;
  speak: string;
  placeholder: string;
  send: string;
  noAgent: string;
  loadError: (m: string) => string;
  speakError: (m: string) => string;
}>;

async function decodeBase64Audio(base64: string): Promise<AudioBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const ctx = new AudioContext();
  return ctx.decodeAudioData(bytes.buffer);
}

export default function TalkingFacePage() {
  const t = useT(messages);
  const stageRef = useRef<AvatarStageHandle>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await authFetch<PaginatedAgents>('/api/v1/agents?limit=100');
        const active = res.data.find((agent) => agent.isActive);
        setAgentId(active?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      }
    })();
  }, []);

  const handleTestSpeak = useCallback(() => {
    stageRef.current?.speakTestPhrase();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !agentId || speaking) return;

    setSpeaking(true);
    setError('');
    try {
      const result = await authFetch<TalkingFaceSpeakResponse>('/api/v1/talkingface/speak', {
        method: 'POST',
        body: JSON.stringify({ agentDefinitionId: agentId, input: text, sessionId }),
      });
      setSessionId(result.sessionId ?? undefined);
      setInput('');
      const audio = await decodeBase64Audio(result.audio);
      stageRef.current?.speak({
        audio,
        words: result.words,
        wtimes: result.wtimes,
        wdurations: result.wdurations,
      });
    } catch (err) {
      setError(t.speakError(err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSpeaking(false);
    }
  }, [input, agentId, sessionId, speaking, t]);

  return (
    <div className="flex min-w-0 flex-col gap-4 p-6">
      <header className="flex flex-col gap-1 border-b border-border/60 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.description}</p>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="h-[60vh] w-full max-w-xl">
        <AvatarStage3D
          ref={stageRef}
          onReady={() => setReady(true)}
          onError={(m) => setError(t.loadError(m))}
        />
      </div>

      <div className="flex w-full max-w-xl items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={t.placeholder}
          disabled={!ready || !agentId || speaking}
        />
        <Button onClick={() => void handleSend()} disabled={!ready || !agentId || speaking}>
          {speaking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {t.send}
        </Button>
      </div>

      {ready && !agentId && <p className="text-sm text-muted-foreground">{t.noAgent}</p>}

      <button
        onClick={handleTestSpeak}
        disabled={!ready}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Volume2 className="size-4" />
        {t.speak}
      </button>
    </div>
  );
}
