'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT, type Messages } from '@/lib/i18n';

const messages = {
  en: {
    title: 'Website currently not in service',
    description: 'Something went wrong. Please try again later.',
    tryAgain: 'Try again',
    goHome: 'Go to Home',
  },
  'zh-TW': {
    title: '網站目前暫停服務',
    description: '發生錯誤，請稍後再試。',
    tryAgain: '重試',
    goHome: '前往首頁',
  },
} satisfies Messages<{
  title: string;
  description: string;
  tryAgain: string;
  goHome: string;
}>;

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT(messages);

  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          {t.tryAgain}
        </Button>
        <Button onClick={() => (window.location.href = '/conversations')}>{t.goHome}</Button>
      </div>
    </div>
  );
}
