'use client';

import { useT, type Messages } from '@/lib/i18n';
import { ProvidersTab } from '../providers-tab';

const messages = {
  en: {
    title: 'Providers',
    description: 'Manage AI provider API keys and configurations.',
  },
  'zh-TW': {
    title: '供應商',
    description: '管理 AI 供應商的 API 金鑰與設定。',
  },
} satisfies Messages<{
  title: string;
  description: string;
}>;

export default function ProvidersPage() {
  const t = useT(messages);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <ProvidersTab />
    </div>
  );
}
