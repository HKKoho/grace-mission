'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT, type Messages } from '@/lib/i18n';

const messages = {
  en: {
    addPlaceholder: 'Add an item…',
    add: 'Add',
    remove: (item: string) => `Remove ${item}`,
  },
  'zh-TW': {
    addPlaceholder: '新增項目…',
    add: '新增',
    remove: (item: string) => `移除${item}`,
  },
} satisfies Messages<{
  addPlaceholder: string;
  add: string;
  remove: (item: string) => string;
}>;

export function EditableStringList({
  items,
  onChange,
}: {
  items: readonly string[];
  onChange: (items: readonly string[]) => void;
}) {
  const t = useT(messages);
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const trimmed = draft.trim();
    if (trimmed === '' || items.includes(trimmed)) return;
    onChange([...items, trimmed]);
    setDraft('');
  };

  const removeItem = (item: string) => {
    onChange(items.filter((existing) => existing !== item));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="gap-1 pr-1">
            {item}
            <button
              type="button"
              onClick={() => removeItem(item)}
              aria-label={t.remove(item)}
              className="rounded-full p-0.5 hover:bg-foreground/10"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={t.addPlaceholder}
          className="h-8"
        />
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus className="mr-1 size-3.5" />
          {t.add}
        </Button>
      </div>
    </div>
  );
}
