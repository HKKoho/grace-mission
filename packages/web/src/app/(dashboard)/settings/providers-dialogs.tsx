'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ApiProvider } from './providers-tab';
import { useT, type Messages } from '@/lib/i18n';

// ------------------------------------------------------------------ //
//  Messages                                                           //
// ------------------------------------------------------------------ //

const messages = {
  en: {
    password: {
      hide: 'Hide password',
      show: 'Show password',
    },
    create: {
      title: 'Add Provider',
      description: 'Configure a new AI provider with API credentials.',
      providerId: 'Provider ID',
      providerIdPlaceholder: 'e.g. openai, anthropic, custom-llm',
      providerIdHelp: 'Unique identifier for this provider (lowercase, no spaces).',
      displayName: 'Display Name',
      displayNamePlaceholder: 'e.g. OpenAI, Anthropic, Custom LLM',
      apiKey: 'API Key',
      apiKeyHelp: 'Encrypted at rest. Never displayed in full after saving.',
      baseUrl: 'Base URL (optional)',
      baseUrlPlaceholder: 'https://api.example.com/v1',
      baseUrlHelp: 'Only needed for custom or self-hosted endpoints.',
      setDefault: 'Set as default provider',
      cancel: 'Cancel',
      submit: 'Add Provider',
    },
    edit: {
      title: 'Edit Provider',
      description: (name: string) => `Update settings for ${name}.`,
      providerId: 'Provider ID',
      displayName: 'Display Name',
      apiKey: 'API Key',
      apiKeyPlaceholder: 'Leave blank to keep current key',
      apiKeyHelp: (key: string) => `Current key: ${key}. Leave blank to keep it.`,
      baseUrl: 'Base URL (optional)',
      baseUrlPlaceholder: 'https://api.example.com/v1',
      cancel: 'Cancel',
      submit: 'Save',
    },
  },
  'zh-TW': {
    password: {
      hide: '隱藏密碼',
      show: '顯示密碼',
    },
    create: {
      title: '新增供應商',
      description: '使用 API 憑證設定新的 AI 供應商。',
      providerId: '供應商 ID',
      providerIdPlaceholder: '例如 openai、anthropic、custom-llm',
      providerIdHelp: '此供應商的唯一識別碼（小寫，不含空格）。',
      displayName: '顯示名稱',
      displayNamePlaceholder: '例如 OpenAI、Anthropic、Custom LLM',
      apiKey: 'API 金鑰',
      apiKeyHelp: '儲存時加密。儲存後不會再完整顯示。',
      baseUrl: '基礎網址（選填）',
      baseUrlPlaceholder: 'https://api.example.com/v1',
      baseUrlHelp: '僅在使用自訂或自架端點時需要。',
      setDefault: '設為預設供應商',
      cancel: '取消',
      submit: '新增供應商',
    },
    edit: {
      title: '編輯供應商',
      description: (name: string) => `更新 ${name} 的設定。`,
      providerId: '供應商 ID',
      displayName: '顯示名稱',
      apiKey: 'API 金鑰',
      apiKeyPlaceholder: '留空以保留目前的金鑰',
      apiKeyHelp: (key: string) => `目前金鑰：${key}。留空以保留。`,
      baseUrl: '基礎網址（選填）',
      baseUrlPlaceholder: 'https://api.example.com/v1',
      cancel: '取消',
      submit: '儲存',
    },
  },
} satisfies Messages<{
  password: {
    hide: string;
    show: string;
  };
  create: {
    title: string;
    description: string;
    providerId: string;
    providerIdPlaceholder: string;
    providerIdHelp: string;
    displayName: string;
    displayNamePlaceholder: string;
    apiKey: string;
    apiKeyHelp: string;
    baseUrl: string;
    baseUrlPlaceholder: string;
    baseUrlHelp: string;
    setDefault: string;
    cancel: string;
    submit: string;
  };
  edit: {
    title: string;
    description: (name: string) => string;
    providerId: string;
    displayName: string;
    apiKey: string;
    apiKeyPlaceholder: string;
    apiKeyHelp: (key: string) => string;
    baseUrl: string;
    baseUrlPlaceholder: string;
    cancel: string;
    submit: string;
  };
}>;

// ------------------------------------------------------------------ //
//  Password Input with visibility toggle                              //
// ------------------------------------------------------------------ //

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  const t = useT(messages);
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 size-9 text-muted-foreground hover:text-foreground"
        onClick={() => {
          setVisible((v) => !v);
        }}
        tabIndex={-1}
        aria-label={visible ? t.password.hide : t.password.show}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ //
//  Create Provider Dialog                                             //
// ------------------------------------------------------------------ //

export function CreateProviderDialog({
  open,
  onOpenChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const t = useT(messages);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.create.title}</DialogTitle>
          <DialogDescription>{t.create.description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const data: Record<string, unknown> = {
              provider: form.get('provider'),
              displayName: form.get('displayName'),
              apiKey: form.get('apiKey'),
              isDefault: form.get('isDefault') === 'on',
            };
            const baseUrl = form.get('apiBaseUrl') as string;
            if (baseUrl) data['apiBaseUrl'] = baseUrl;
            onSubmit(data);
          }}
          className="flex flex-col gap-4"
          autoComplete="off"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-provider">{t.create.providerId}</Label>
            <Input
              id="create-provider"
              name="provider"
              placeholder={t.create.providerIdPlaceholder}
              required
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t.create.providerIdHelp}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-displayName">{t.create.displayName}</Label>
            <Input
              id="create-displayName"
              name="displayName"
              placeholder={t.create.displayNamePlaceholder}
              required
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-apiKey">{t.create.apiKey}</Label>
            <PasswordInput
              id="create-apiKey"
              name="apiKey"
              placeholder="sk-..."
              required
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">{t.create.apiKeyHelp}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-apiBaseUrl">{t.create.baseUrl}</Label>
            <Input
              id="create-apiBaseUrl"
              name="apiBaseUrl"
              type="url"
              placeholder={t.create.baseUrlPlaceholder}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t.create.baseUrlHelp}</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="create-isDefault"
              name="isDefault"
              className="size-4 rounded border"
            />
            <Label htmlFor="create-isDefault">{t.create.setDefault}</Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t.create.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t.create.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ //
//  Edit Provider Dialog                                               //
// ------------------------------------------------------------------ //

export function EditProviderDialog({
  provider,
  onOpenChange,
  saving,
  onSubmit,
}: {
  provider: ApiProvider | null;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSubmit: (providerName: string, data: Record<string, unknown>) => void;
}) {
  const t = useT(messages);
  if (!provider) return null;

  return (
    <Dialog open={provider !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.edit.title}</DialogTitle>
          <DialogDescription>{t.edit.description(provider.displayName)}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const data: Record<string, unknown> = {};
            const displayName = form.get('displayName') as string;
            const apiKey = form.get('apiKey') as string;
            const baseUrl = form.get('apiBaseUrl') as string;
            if (displayName) data['displayName'] = displayName;
            if (apiKey) data['apiKey'] = apiKey;
            data['apiBaseUrl'] = baseUrl || null;
            onSubmit(provider.provider, data);
          }}
          className="flex flex-col gap-4"
          autoComplete="off"
        >
          <div className="flex flex-col gap-2">
            <Label>{t.edit.providerId}</Label>
            <Input value={provider.provider} disabled />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-displayName">{t.edit.displayName}</Label>
            <Input
              id="edit-displayName"
              name="displayName"
              defaultValue={provider.displayName}
              required
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-apiKey">{t.edit.apiKey}</Label>
            <PasswordInput
              id="edit-apiKey"
              name="apiKey"
              placeholder={t.edit.apiKeyPlaceholder}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">{t.edit.apiKeyHelp(provider.apiKey)}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-apiBaseUrl">{t.edit.baseUrl}</Label>
            <Input
              id="edit-apiBaseUrl"
              name="apiBaseUrl"
              type="url"
              defaultValue={provider.apiBaseUrl ?? ''}
              placeholder={t.edit.baseUrlPlaceholder}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t.edit.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t.edit.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
