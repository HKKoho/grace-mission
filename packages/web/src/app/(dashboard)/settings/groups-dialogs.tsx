'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { authFetch } from '@/lib/auth';
import type { ApiGroup, ApiGroupMember } from './groups-tab';
import { useT, type Messages } from '@/lib/i18n';

// ------------------------------------------------------------------ //
//  Messages                                                           //
// ------------------------------------------------------------------ //

const messages = {
  en: {
    create: {
      title: 'Create Group',
      description: 'Add a new group for memory sharing and access control.',
      name: 'Name',
      namePlaceholder: 'Engineering Team',
      descLabel: 'Description',
      descPlaceholder: 'Optional description for this group',
      cancel: 'Cancel',
      submit: 'Create',
    },
    edit: {
      title: 'Edit Group',
      description: (name: string) => `Update settings for ${name}.`,
      name: 'Name',
      descLabel: 'Description',
      cancel: 'Cancel',
      submit: 'Save',
    },
    members: {
      title: (name: string) => `Members of ${name}`,
      description: 'Manage who belongs to this group and their roles.',
      errors: {
        load: 'Failed to load members',
        add: 'Failed to add member',
        remove: 'Failed to remove member',
        updateRole: 'Failed to update role',
      },
      emptyState: 'No members in this group yet.',
      colName: 'Name',
      colEmail: 'Email',
      colRole: 'Role',
      roleOwner: 'Owner',
      roleMember: 'Member',
      cannotRemoveOnlyOwner: 'Cannot remove the only owner',
      removeMember: 'Remove member',
      user: 'User',
      selectUser: 'Select a user...',
      role: 'Role',
      add: 'Add',
      cancel: 'Cancel',
      addMember: 'Add Member',
    },
  },
  'zh-TW': {
    create: {
      title: '建立群組',
      description: '新增群組以進行記憶共享與存取控制。',
      name: '名稱',
      namePlaceholder: '工程團隊',
      descLabel: '描述',
      descPlaceholder: '此群組的描述（選填）',
      cancel: '取消',
      submit: '建立',
    },
    edit: {
      title: '編輯群組',
      description: (name: string) => `更新 ${name} 的設定。`,
      name: '名稱',
      descLabel: '描述',
      cancel: '取消',
      submit: '儲存',
    },
    members: {
      title: (name: string) => `${name} 的成員`,
      description: '管理此群組的成員及其角色。',
      errors: {
        load: '載入成員失敗',
        add: '新增成員失敗',
        remove: '移除成員失敗',
        updateRole: '更新角色失敗',
      },
      emptyState: '此群組尚無任何成員。',
      colName: '名稱',
      colEmail: '電子郵件',
      colRole: '角色',
      roleOwner: '擁有者',
      roleMember: '成員',
      cannotRemoveOnlyOwner: '無法移除唯一的擁有者',
      removeMember: '移除成員',
      user: '使用者',
      selectUser: '選擇使用者...',
      role: '角色',
      add: '新增',
      cancel: '取消',
      addMember: '新增成員',
    },
  },
} satisfies Messages<{
  create: {
    title: string;
    description: string;
    name: string;
    namePlaceholder: string;
    descLabel: string;
    descPlaceholder: string;
    cancel: string;
    submit: string;
  };
  edit: {
    title: string;
    description: (name: string) => string;
    name: string;
    descLabel: string;
    cancel: string;
    submit: string;
  };
  members: {
    title: (name: string) => string;
    description: string;
    errors: {
      load: string;
      add: string;
      remove: string;
      updateRole: string;
    };
    emptyState: string;
    colName: string;
    colEmail: string;
    colRole: string;
    roleOwner: string;
    roleMember: string;
    cannotRemoveOnlyOwner: string;
    removeMember: string;
    user: string;
    selectUser: string;
    role: string;
    add: string;
    cancel: string;
    addMember: string;
  };
}>;

interface ApiUser {
  id: string;
  name: string;
  email: string;
}

interface PaginatedUsers {
  data: ApiUser[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ------------------------------------------------------------------ //
//  Create Group Dialog                                                //
// ------------------------------------------------------------------ //

export function CreateGroupDialog({
  open,
  onOpenChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSubmit: (form: FormData) => void;
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
            onSubmit(new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-group-name">{t.create.name}</Label>
            <Input
              id="create-group-name"
              name="name"
              placeholder={t.create.namePlaceholder}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-group-description">{t.create.descLabel}</Label>
            <textarea
              id="create-group-description"
              name="description"
              className="rounded-md border bg-background px-3 py-2 text-sm"
              placeholder={t.create.descPlaceholder}
              rows={3}
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
//  Edit Group Dialog                                                  //
// ------------------------------------------------------------------ //

export function EditGroupDialog({
  group,
  onOpenChange,
  saving,
  onSubmit,
}: {
  group: ApiGroup | null;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSubmit: (id: string, form: FormData) => void;
}) {
  const t = useT(messages);
  if (!group) return null;

  return (
    <Dialog open={group !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.edit.title}</DialogTitle>
          <DialogDescription>{t.edit.description(group.name)}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(group.id, new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-group-name">{t.edit.name}</Label>
            <Input id="edit-group-name" name="name" defaultValue={group.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-group-description">{t.edit.descLabel}</Label>
            <textarea
              id="edit-group-description"
              name="description"
              className="rounded-md border bg-background px-3 py-2 text-sm"
              defaultValue={group.description ?? ''}
              rows={3}
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

// ------------------------------------------------------------------ //
//  Members Dialog                                                     //
// ------------------------------------------------------------------ //

export function MembersDialog({
  group,
  onOpenChange,
}: {
  group: ApiGroup | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [members, setMembers] = useState<ApiGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<'OWNER' | 'MEMBER'>('MEMBER');
  const t = useT(messages);

  const fetchMembers = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError('');
    try {
      const res = await authFetch<ApiGroupMember[]>(`/admin/groups/${group.id}/members`);
      setMembers(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.members.errors.load);
    } finally {
      setLoading(false);
    }
  }, [group, t]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch<PaginatedUsers>('/admin/users?limit=100');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Silently fail — user list is non-critical
    }
  }, []);

  useEffect(() => {
    if (group) {
      void fetchMembers();
      void fetchUsers();
    }
  }, [group, fetchMembers, fetchUsers]);

  if (!group) return null;

  const memberUserIds = new Set(members.map((m) => m.userId));
  const availableUsers = users.filter((u) => !memberUserIds.has(u.id));
  const ownerCount = members.filter((m) => m.role === 'OWNER').length;

  async function handleAddMember() {
    if (!addUserId || !group) return;
    setSaving(true);
    setError('');
    try {
      await authFetch(`/admin/groups/${group.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: addUserId, role: addRole }),
      });
      setAddOpen(false);
      setAddUserId('');
      setAddRole('MEMBER');
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.members.errors.add);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!group) return;
    setSaving(true);
    setError('');
    try {
      await authFetch(`/admin/groups/${group.id}/members/${userId}`, {
        method: 'DELETE',
      });
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.members.errors.remove);
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: 'OWNER' | 'MEMBER') {
    if (!group) return;
    setSaving(true);
    setError('');
    try {
      await authFetch(`/admin/groups/${group.id}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.members.errors.updateRole);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={group !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.members.title(group.name)}</DialogTitle>
          <DialogDescription>{t.members.description}</DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-md border bg-background/30 backdrop-blur-sm p-6 text-center text-sm text-muted-foreground">
            {t.members.emptyState}
          </div>
        ) : (
          <div className="rounded-md border bg-background/30 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.members.colName}</TableHead>
                  <TableHead>{t.members.colEmail}</TableHead>
                  <TableHead>{t.members.colRole}</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell className="font-medium">{member.user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{member.user.email}</TableCell>
                    <TableCell>
                      <select
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                        value={member.role}
                        onChange={(e) => {
                          void handleRoleChange(
                            member.userId,
                            e.target.value as 'OWNER' | 'MEMBER',
                          );
                        }}
                        disabled={saving || (member.role === 'OWNER' && ownerCount <= 1)}
                      >
                        <option value="OWNER">{t.members.roleOwner}</option>
                        <option value="MEMBER">{t.members.roleMember}</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          void handleRemoveMember(member.userId);
                        }}
                        disabled={saving || (member.role === 'OWNER' && ownerCount <= 1)}
                        title={
                          member.role === 'OWNER' && ownerCount <= 1
                            ? t.members.cannotRemoveOnlyOwner
                            : t.members.removeMember
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add Member Section */}
        {addOpen ? (
          <div className="flex items-end gap-3 rounded-md border p-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="add-member-user">{t.members.user}</Label>
              <select
                id="add-member-user"
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={addUserId}
                onChange={(e) => {
                  setAddUserId(e.target.value);
                }}
              >
                <option value="">{t.members.selectUser}</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-member-role">{t.members.role}</Label>
              <select
                id="add-member-role"
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={addRole}
                onChange={(e) => {
                  setAddRole(e.target.value as 'OWNER' | 'MEMBER');
                }}
              >
                <option value="MEMBER">{t.members.roleMember}</option>
                <option value="OWNER">{t.members.roleOwner}</option>
              </select>
            </div>
            <Button
              size="sm"
              disabled={saving || !addUserId}
              onClick={() => {
                void handleAddMember();
              }}
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t.members.add}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                setAddUserId('');
              }}
            >
              {t.members.cancel}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              setAddOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" />
            {t.members.addMember}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
