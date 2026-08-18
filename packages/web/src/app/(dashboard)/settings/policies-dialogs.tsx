'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { authFetch } from '@/lib/auth';
import { useT, type Messages } from '@/lib/i18n';
import type { ApiPolicy } from './policies-tab';

// ------------------------------------------------------------------ //
//  i18n                                                               //
// ------------------------------------------------------------------ //

const messages = {
  en: {
    create: {
      title: 'Create Policy',
      description: 'Define a new governance policy with quotas and limits.',
      cancel: 'Cancel',
      submit: 'Create',
    },
    edit: {
      title: 'Edit Policy',
      description: (name: string) => `Update settings for ${name}.`,
      cancel: 'Cancel',
      submit: 'Save',
    },
    fields: {
      name: 'Name',
      namePlaceholder: 'e.g. Standard, Pro, Enterprise',
      description: 'Description',
      descriptionPlaceholder: 'Brief description of this policy tier',
      tokenBudget: 'Token Budget (cents/mo)',
      tokenBudgetPlaceholder: 'Empty = unlimited',
      tokenBudgetHelp: 'In USD cents. Leave empty for unlimited.',
      maxAgents: 'Max Agents',
      maxSkills: 'Max Skills',
      maxMemoryItems: 'Max Memory Items',
      maxGroupsOwned: 'Max Groups Owned',
      allowedProviders: 'Allowed Providers',
      loadingProviders: 'Loading providers...',
      noProviders: 'No providers configured. Add providers in Settings → Providers first.',
      providersHelp: 'Select which AI providers users on this policy can access.',
      cronSection: 'Scheduled Tasks (Cron)',
      cronEnable: 'Enable cron scheduling',
      maxTasks: 'Max Tasks',
      minInterval: 'Min Interval (s)',
      maxTokensPerRun: 'Max Tokens/Run',
      unlimited: 'Unlimited',
    },
  },
  'zh-TW': {
    create: {
      title: '建立政策',
      description: '定義一個包含配額與上限的新治理政策。',
      cancel: '取消',
      submit: '建立',
    },
    edit: {
      title: '編輯政策',
      description: (name: string) => `更新 ${name} 的設定。`,
      cancel: '取消',
      submit: '儲存',
    },
    fields: {
      name: '名稱',
      namePlaceholder: '例如：標準、專業、企業',
      description: '描述',
      descriptionPlaceholder: '此政策層級的簡短描述',
      tokenBudget: 'Token 預算（美分／月）',
      tokenBudgetPlaceholder: '留空 = 無限制',
      tokenBudgetHelp: '以美分計。留空表示無限制。',
      maxAgents: '最大代理數',
      maxSkills: '最大技能數',
      maxMemoryItems: '最大記憶項目數',
      maxGroupsOwned: '最大擁有群組數',
      allowedProviders: '允許的供應商',
      loadingProviders: '正在載入供應商…',
      noProviders: '尚未設定供應商。請先在「設定 → 供應商」中新增供應商。',
      providersHelp: '選擇此政策的使用者可存取哪些 AI 供應商。',
      cronSection: '排程任務（Cron）',
      cronEnable: '啟用 cron 排程',
      maxTasks: '最大任務數',
      minInterval: '最小間隔（秒）',
      maxTokensPerRun: '每次執行最大 Token',
      unlimited: '無限制',
    },
  },
} satisfies Messages<{
  create: {
    title: string;
    description: string;
    cancel: string;
    submit: string;
  };
  edit: {
    title: string;
    description: (name: string) => string;
    cancel: string;
    submit: string;
  };
  fields: {
    name: string;
    namePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    tokenBudget: string;
    tokenBudgetPlaceholder: string;
    tokenBudgetHelp: string;
    maxAgents: string;
    maxSkills: string;
    maxMemoryItems: string;
    maxGroupsOwned: string;
    allowedProviders: string;
    loadingProviders: string;
    noProviders: string;
    providersHelp: string;
    cronSection: string;
    cronEnable: string;
    maxTasks: string;
    minInterval: string;
    maxTokensPerRun: string;
    unlimited: string;
  };
}>;

// ------------------------------------------------------------------ //
//  Types                                                              //
// ------------------------------------------------------------------ //

interface ProviderOption {
  provider: string;
  displayName: string;
}

// ------------------------------------------------------------------ //
//  Helpers                                                            //
// ------------------------------------------------------------------ //

function parseIntOrNull(value: string): number | null {
  if (value === '' || value === 'null') return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function buildPolicyData(
  form: FormData,
  availableProviders: ProviderOption[],
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: form.get('name'),
    description: (form.get('description') as string) || null,
    maxTokenBudget: parseIntOrNull(form.get('maxTokenBudget') as string),
    maxAgents: parseInt(form.get('maxAgents') as string, 10) || 5,
    maxSkills: parseInt(form.get('maxSkills') as string, 10) || 10,
    maxMemoryItems: parseInt(form.get('maxMemoryItems') as string, 10) || 1000,
    maxGroupsOwned: parseInt(form.get('maxGroupsOwned') as string, 10) || 5,
  };

  const providers: string[] = [];
  for (const p of availableProviders) {
    if (form.get(`provider_${p.provider}`) === 'on') providers.push(p.provider);
  }
  data['allowedProviders'] = providers;

  // Cron settings
  data['cronEnabled'] = form.get('cronEnabled') === 'on';
  data['maxScheduledTasks'] = parseInt(form.get('maxScheduledTasks') as string, 10) || 5;
  data['minCronIntervalSecs'] = parseInt(form.get('minCronIntervalSecs') as string, 10) || 300;
  data['maxTokensPerCronRun'] = parseIntOrNull(form.get('maxTokensPerCronRun') as string);

  return data;
}

function useProviders() {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res =
        await authFetch<{ provider: string; displayName: string; isEnabled: boolean }[]>(
          '/admin/providers',
        );
      const enabled = (res ?? []).filter((p) => p.isEnabled);
      setProviders(enabled.map((p) => ({ provider: p.provider, displayName: p.displayName })));
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  return { providers, loading };
}

// ------------------------------------------------------------------ //
//  Create Policy Dialog                                               //
// ------------------------------------------------------------------ //

export function CreatePolicyDialog({
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
  const { providers, loading: providersLoading } = useProviders();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.create.title}</DialogTitle>
          <DialogDescription>{t.create.description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(buildPolicyData(new FormData(e.currentTarget), providers));
          }}
          className="flex flex-col gap-4"
        >
          <PolicyFormFields providers={providers} providersLoading={providersLoading} />
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
            <Button type="submit" disabled={saving || providersLoading}>
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
//  Edit Policy Dialog                                                 //
// ------------------------------------------------------------------ //

export function EditPolicyDialog({
  policy,
  onOpenChange,
  saving,
  onSubmit,
}: {
  policy: ApiPolicy | null;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSubmit: (id: string, data: Record<string, unknown>) => void;
}) {
  const t = useT(messages);
  const { providers, loading: providersLoading } = useProviders();

  if (!policy) return null;

  return (
    <Dialog open={policy !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.edit.title}</DialogTitle>
          <DialogDescription>{t.edit.description(policy.name)}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(policy.id, buildPolicyData(new FormData(e.currentTarget), providers));
          }}
          className="flex flex-col gap-4"
        >
          <PolicyFormFields
            policy={policy}
            providers={providers}
            providersLoading={providersLoading}
          />
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
            <Button type="submit" disabled={saving || providersLoading}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t.edit.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ //
//  Shared Form Fields                                                 //
// ------------------------------------------------------------------ //

function PolicyFormFields({
  policy,
  providers,
  providersLoading,
}: {
  policy?: ApiPolicy;
  providers: ProviderOption[];
  providersLoading: boolean;
}) {
  const t = useT(messages);
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="policy-name">{t.fields.name}</Label>
        <Input
          id="policy-name"
          name="name"
          placeholder={t.fields.namePlaceholder}
          defaultValue={policy?.name ?? ''}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="policy-description">{t.fields.description}</Label>
        <Input
          id="policy-description"
          name="description"
          placeholder={t.fields.descriptionPlaceholder}
          defaultValue={policy?.description ?? ''}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="policy-maxTokenBudget">{t.fields.tokenBudget}</Label>
          <Input
            id="policy-maxTokenBudget"
            name="maxTokenBudget"
            type="number"
            min="0"
            placeholder={t.fields.tokenBudgetPlaceholder}
            defaultValue={policy?.maxTokenBudget ?? ''}
          />
          <p className="text-xs text-muted-foreground">{t.fields.tokenBudgetHelp}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="policy-maxAgents">{t.fields.maxAgents}</Label>
          <Input
            id="policy-maxAgents"
            name="maxAgents"
            type="number"
            min="1"
            defaultValue={policy?.maxAgents ?? 5}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="policy-maxSkills">{t.fields.maxSkills}</Label>
          <Input
            id="policy-maxSkills"
            name="maxSkills"
            type="number"
            min="1"
            defaultValue={policy?.maxSkills ?? 10}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="policy-maxMemoryItems">{t.fields.maxMemoryItems}</Label>
          <Input
            id="policy-maxMemoryItems"
            name="maxMemoryItems"
            type="number"
            min="1"
            defaultValue={policy?.maxMemoryItems ?? 1000}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="policy-maxGroupsOwned">{t.fields.maxGroupsOwned}</Label>
        <Input
          id="policy-maxGroupsOwned"
          name="maxGroupsOwned"
          type="number"
          min="1"
          defaultValue={policy?.maxGroupsOwned ?? 5}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t.fields.allowedProviders}</Label>
        {providersLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t.fields.loadingProviders}
          </div>
        ) : providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.fields.noProviders}</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {providers.map((prov) => (
              <label key={prov.provider} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`provider_${prov.provider}`}
                  className="size-4 rounded border"
                  defaultChecked={policy?.allowedProviders.includes(prov.provider) ?? false}
                />
                {prov.displayName}
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t.fields.providersHelp}</p>
      </div>

      {/* Cron Scheduling */}
      <div className="flex flex-col gap-2">
        <Label>{t.fields.cronSection}</Label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="cronEnabled"
            className="size-4 rounded border"
            defaultChecked={policy?.cronEnabled ?? false}
          />
          {t.fields.cronEnable}
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="policy-maxScheduledTasks">{t.fields.maxTasks}</Label>
          <Input
            id="policy-maxScheduledTasks"
            name="maxScheduledTasks"
            type="number"
            min="1"
            defaultValue={policy?.maxScheduledTasks ?? 5}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="policy-minCronIntervalSecs">{t.fields.minInterval}</Label>
          <Input
            id="policy-minCronIntervalSecs"
            name="minCronIntervalSecs"
            type="number"
            min="60"
            defaultValue={policy?.minCronIntervalSecs ?? 300}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="policy-maxTokensPerCronRun">{t.fields.maxTokensPerRun}</Label>
          <Input
            id="policy-maxTokensPerCronRun"
            name="maxTokensPerCronRun"
            type="number"
            min="0"
            placeholder={t.fields.unlimited}
            defaultValue={policy?.maxTokensPerCronRun ?? ''}
          />
        </div>
      </div>
    </>
  );
}
