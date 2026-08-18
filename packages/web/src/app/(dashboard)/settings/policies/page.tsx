'use client';

import { useT, type Messages } from '@/lib/i18n';
import { PoliciesTab } from '../policies-tab';

const messages = {
  en: {
    title: 'Policies',
    description: 'Manage governance policies, quotas, and limits.',
  },
  'zh-TW': {
    title: '政策',
    description: '管理治理政策、配額與上限。',
  },
} satisfies Messages<{
  title: string;
  description: string;
}>;

export default function PoliciesPage() {
  const t = useT(messages);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <PoliciesTab />
    </div>
  );
}
