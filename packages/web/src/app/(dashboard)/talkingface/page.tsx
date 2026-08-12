'use client';

import { useCallback, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useT, type Messages } from '@/lib/i18n';
import {
  AvatarStage3D,
  type AvatarStageHandle,
} from '@/components/dashboard/talkingface/AvatarStage3D';

const messages = {
  en: {
    title: 'Talking Face',
    subtitle: 'avatar render smoke test — Milestone 1',
    description:
      'Renders a 3D avatar and drives it with synthetic viseme timings. Not wired to the agent yet — that lands in later milestones (see talkingface/build-plan.md).',
    speak: 'Test speak',
    loadError: (m: string) => `Failed to load avatar: ${m}`,
  },
  'zh-TW': {
    title: '會說話的臉',
    subtitle: '虛擬形象渲染測試 — 第一階段',
    description:
      '渲染 3D 虛擬形象並以合成的口型時間資料驅動。尚未串接代理——將於後續階段完成（詳見 talkingface/build-plan.md）。',
    speak: '測試發聲',
    loadError: (m: string) => `虛擬形象載入失敗：${m}`,
  },
} satisfies Messages<{
  title: string;
  subtitle: string;
  description: string;
  speak: string;
  loadError: (m: string) => string;
}>;

export default function TalkingFacePage() {
  const t = useT(messages);
  const stageRef = useRef<AvatarStageHandle>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const handleSpeak = useCallback(() => {
    stageRef.current?.speakTestPhrase();
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-4 p-6">
      <header className="flex flex-col gap-1 border-b border-border/60 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.description}</p>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.loadError(error)}
        </div>
      )}

      <div className="h-[60vh] w-full max-w-xl">
        <AvatarStage3D
          ref={stageRef}
          onReady={() => setReady(true)}
          onError={(m) => setError(m)}
        />
      </div>

      <button
        onClick={handleSpeak}
        disabled={!ready}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Volume2 className="size-4" />
        {t.speak}
      </button>
    </div>
  );
}
