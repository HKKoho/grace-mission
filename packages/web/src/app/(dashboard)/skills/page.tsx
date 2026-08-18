'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Package, Plus, User, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { authFetch } from '@/lib/auth';
import type { SkillReadResult } from '@clawix/shared';
import { BuiltinCard, CustomCard, type Skill, dirNameFromPath } from './skills-cards';
import { CreateDialog, EditDialog, RenameDialog, DeleteDialog } from './skills-dialogs';
import { useT, type Messages } from '@/lib/i18n';

const messages = {
  en: {
    title: 'Skills',
    descriptionPrefix:
      "Skills extend your agent's capabilities with specialized knowledge and workflows. Custom skills live inside your workspace under",
    loopHeading: 'How the skill validate & fix loop works',
    loopAlt: 'How the Clawix agent validates and fixes a skill in place',
    failedToLoad: 'Failed to load skills',
    failedToLoadContent: 'Failed to load skill content',
    builtinHeading: 'Built-in Skills',
    noBuiltin: 'No built-in skills found.',
    yourSkills: 'Your Skills',
    createSkill: 'Create skill',
    noCustom: 'No custom skills yet. Click "Create skill" to add one.',
  },
  'zh-TW': {
    title: '技能',
    descriptionPrefix:
      '技能透過專業知識與工作流程擴充代理的能力。自訂技能存放於您工作區中的下列路徑下',
    loopHeading: '技能驗證與修正流程的運作方式',
    loopAlt: 'Clawix 代理如何就地驗證並修正技能',
    failedToLoad: '載入技能失敗',
    failedToLoadContent: '載入技能內容失敗',
    builtinHeading: '內建技能',
    noBuiltin: '找不到內建技能。',
    yourSkills: '您的技能',
    createSkill: '建立技能',
    noCustom: '尚無自訂技能。點選「建立技能」即可新增。',
  },
} satisfies Messages<{
  title: string;
  descriptionPrefix: string;
  loopHeading: string;
  loopAlt: string;
  failedToLoad: string;
  failedToLoadContent: string;
  builtinHeading: string;
  noBuiltin: string;
  yourSkills: string;
  createSkill: string;
  noCustom: string;
}>;

export default function SkillsPage() {
  const t = useT(messages);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ dirName: string; content: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ dirName: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ dirName: string; name: string } | null>(null);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch<{ success: boolean; data: Skill[] }>('/api/v1/skills');
      setSkills(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch {
      setError(t.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  const builtinSkills = skills.filter((s) => s.source === 'builtin');
  const customSkills = skills.filter((s) => s.source === 'custom');

  const handleEditClick = async (skill: Skill) => {
    const dirName = dirNameFromPath(skill.path);
    try {
      const res = await authFetch<{ success: boolean; data: SkillReadResult }>(
        `/api/v1/skills/${dirName}`,
      );
      setEditTarget({ dirName, content: res.data.content });
    } catch {
      setError(t.failedToLoadContent);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.descriptionPrefix}{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/skills/&lt;name&gt;</code>.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.loopHeading}
        </p>
        <img
          src="/images/clawix_skill_validate_and_fix_loop.svg"
          alt={t.loopAlt}
          className="mx-auto w-full max-w-2xl"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Built-in */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t.builtinHeading}</h2>
          <Badge variant="secondary" className="text-xs">
            {builtinSkills.length}
          </Badge>
        </div>
        {builtinSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noBuiltin}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {builtinSkills.map((skill) => (
              <BuiltinCard key={skill.path} skill={skill} />
            ))}
          </div>
        )}
      </section>

      {/* Custom */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t.yourSkills}</h2>
            <Badge variant="secondary" className="text-xs">
              {customSkills.length}
            </Badge>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            {t.createSkill}
          </Button>
        </div>

        {customSkills.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Wrench className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t.noCustom}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customSkills.map((skill) => {
              const dirName = dirNameFromPath(skill.path);
              return (
                <CustomCard
                  key={skill.path}
                  skill={skill}
                  dirName={dirName}
                  onEdit={() => handleEditClick(skill)}
                  onRename={() => setRenameTarget({ dirName })}
                  onDelete={() => setDeleteTarget({ dirName, name: skill.name })}
                />
              );
            })}
          </div>
        )}
      </section>

      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void fetchSkills();
        }}
      />
      <EditDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          void fetchSkills();
        }}
      />
      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRenamed={() => {
          setRenameTarget(null);
          void fetchSkills();
        }}
      />
      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          void fetchSkills();
        }}
      />
    </div>
  );
}
