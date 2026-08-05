'use client';

import { useT, type Messages } from '@/lib/i18n';
import { CongregationProfileTab } from '../congregation-profile-tab';

const messages = {
  en: {
    title: 'Congregation Profile',
    description:
      'A coarse demographic snapshot of the congregation, used for ministry planning and reporting.',
  },
  'zh-TW': {
    title: '會眾背景設定',
    description: '會眾人口背景的粗略概況，供事工規劃與報告使用。',
  },
} satisfies Messages<{
  title: string;
  description: string;
}>;

export default function CongregationProfilePage() {
  const t = useT(messages);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <CongregationProfileTab />
    </div>
  );
}
