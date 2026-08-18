'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { authFetch } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useT, type Messages } from '@/lib/i18n';

const messages = {
  en: {
    title: 'Scheduled Tasks',
    description: 'Manage recurring and one-time scheduled agent tasks.',
    colName: 'Name',
    colAgent: 'Agent',
    colSchedule: 'Schedule',
    colLastRun: 'Last Run',
    colStatus: 'Status',
    colNextRun: 'Next Run',
    statusPending: 'pending',
    statusRunning: 'running',
    statusCompleted: 'completed',
    statusFailed: 'failed',
    statusCancelled: 'cancelled',
    statusNone: '—',
    viewDetails: 'View Details',
    enable: 'Enable',
    disable: 'Disable',
    delete: 'Delete',
    loading: 'Loading…',
    failedToLoad: 'Failed to load tasks',
    noTasks: 'No scheduled tasks yet.',
    deleteTitle: 'Delete this task?',
    deleteDescription: 'This will permanently remove the scheduled task. This cannot be undone.',
    cancel: 'Cancel',
    confirmDelete: 'Delete',
  },
  'zh-TW': {
    title: '排程任務',
    description: '管理週期性與一次性的排程代理任務。',
    colName: '名稱',
    colAgent: '代理',
    colSchedule: '排程',
    colLastRun: '上次執行',
    colStatus: '狀態',
    colNextRun: '下次執行',
    statusPending: '待處理',
    statusRunning: '執行中',
    statusCompleted: '已完成',
    statusFailed: '失敗',
    statusCancelled: '已取消',
    statusNone: '—',
    viewDetails: '查看詳情',
    enable: '啟用',
    disable: '停用',
    delete: '刪除',
    loading: '載入中…',
    failedToLoad: '載入任務失敗',
    noTasks: '尚無排程任務。',
    deleteTitle: '刪除此任務？',
    deleteDescription: '這將永久移除此排程任務，且無法復原。',
    cancel: '取消',
    confirmDelete: '刪除',
  },
} satisfies Messages<{
  title: string;
  description: string;
  colName: string;
  colAgent: string;
  colSchedule: string;
  colLastRun: string;
  colStatus: string;
  colNextRun: string;
  statusPending: string;
  statusRunning: string;
  statusCompleted: string;
  statusFailed: string;
  statusCancelled: string;
  statusNone: string;
  viewDetails: string;
  enable: string;
  disable: string;
  delete: string;
  loading: string;
  failedToLoad: string;
  noTasks: string;
  deleteTitle: string;
  deleteDescription: string;
  cancel: string;
  confirmDelete: string;
}>;

type TaskSchedule =
  | { type: 'at'; time: string }
  | { type: 'every'; interval: string }
  | { type: 'cron'; expression: string; tz?: string };

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface TaskRow {
  id: string;
  name: string;
  agentDefinitionId: string;
  agentDefinition: { name: string };
  schedule: TaskSchedule;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: TaskStatus | null;
  nextRunAt: string | null;
}

interface TasksListResponse {
  success: boolean;
  data: {
    data: TaskRow[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  };
}

function scheduleLabel(schedule: TaskSchedule): string {
  switch (schedule.type) {
    case 'at':
      return `At ${schedule.time}`;
    case 'every':
      return `Every ${schedule.interval}`;
    case 'cron':
      return schedule.expression;
  }
}

function statusLabel(t: (typeof messages)['en'], status: TaskStatus | null): string {
  switch (status) {
    case 'pending':
      return t.statusPending;
    case 'running':
      return t.statusRunning;
    case 'completed':
      return t.statusCompleted;
    case 'failed':
      return t.statusFailed;
    case 'cancelled':
      return t.statusCancelled;
    default:
      return t.statusNone;
  }
}

function statusVariant(status: TaskStatus | null): 'default' | 'secondary' | 'destructive' {
  if (status === 'completed') return 'default';
  if (status === 'failed') return 'destructive';
  return 'secondary';
}

export default function TasksPage() {
  const t = useT(messages);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await authFetch<TasksListResponse>('/api/v1/tasks?limit=100');
      setTasks(resp.data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEnabled = useCallback(
    async (task: TaskRow) => {
      const previous = tasks;
      setTasks((cur) =>
        cur.map((row) => (row.id === task.id ? { ...row, enabled: !row.enabled } : row)),
      );
      try {
        await authFetch(`/api/v1/tasks/${task.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !task.enabled }),
        });
      } catch (err) {
        setTasks(previous);
        setError(err instanceof Error ? err.message : t.failedToLoad);
      }
    },
    [tasks, t],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authFetch(`/api/v1/tasks/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoad);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.colName}</TableHead>
              <TableHead>{t.colAgent}</TableHead>
              <TableHead>{t.colSchedule}</TableHead>
              <TableHead>{t.colLastRun}</TableHead>
              <TableHead>{t.colStatus}</TableHead>
              <TableHead>{t.colNextRun}</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t.loading}
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t.noTasks}
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id} className={!task.enabled ? 'opacity-50' : undefined}>
                  <TableCell className="font-medium">
                    <Link href={`/tasks/${task.id}`} className="hover:underline">
                      {task.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.agentDefinition.name}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {scheduleLabel(task.schedule)}
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {task.lastRunAt ? new Date(task.lastRunAt).toLocaleString() : t.statusNone}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(task.lastStatus)}>
                      {statusLabel(t, task.lastStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {task.enabled && task.nextRunAt
                      ? new Date(task.nextRunAt).toLocaleString()
                      : t.statusNone}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/tasks/${task.id}`}>{t.viewDetails}</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void toggleEnabled(task)}>
                          {task.enabled ? t.disable : t.enable}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => setDeleteTarget(task)}
                        >
                          {t.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void handleDelete()}>
              {t.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
