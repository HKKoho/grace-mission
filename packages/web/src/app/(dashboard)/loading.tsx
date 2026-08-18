'use client';

import { Loader2 } from 'lucide-react';
import { useT, type Messages } from '@/lib/i18n';

const messages = {
  en: {
    loading: 'Loading...',
  },
  'zh-TW': {
    loading: '載入中...',
  },
} satisfies Messages<{
  loading: string;
}>;

export default function DashboardLoading() {
  const t = useT(messages);
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </div>
    </div>
  );
}
