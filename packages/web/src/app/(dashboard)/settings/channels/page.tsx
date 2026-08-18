'use client';

import { useT, type Messages } from '@/lib/i18n';
import { ChannelsTab } from '../channels-tab';

const messages = {
  en: {
    title: 'Channels',
    description: 'Configure messaging channels and integrations.',
  },
  'zh-TW': {
    title: '頻道',
    description: '設定訊息頻道與整合。',
  },
} satisfies Messages<{
  title: string;
  description: string;
}>;

export default function ChannelsPage() {
  const t = useT(messages);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <ChannelsTab />
    </div>
  );
}
