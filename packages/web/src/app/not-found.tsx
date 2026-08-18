'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useT, type Messages } from '@/lib/i18n';

const messages = {
  en: {
    title: 'Page not found',
    description: 'The page you are looking for does not exist.',
    goHome: 'Go to Home',
  },
  'zh-TW': {
    title: '找不到頁面',
    description: '您要尋找的頁面不存在。',
    goHome: '前往首頁',
  },
} satisfies Messages<{
  title: string;
  description: string;
  goHome: string;
}>;

export default function NotFound() {
  const t = useT(messages);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-muted bg-muted/50">
        <AlertTriangle className="size-8 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Button asChild>
        <Link href="/conversations">{t.goHome}</Link>
      </Button>
    </div>
  );
}
