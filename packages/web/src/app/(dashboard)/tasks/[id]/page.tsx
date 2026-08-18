'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useT, type Messages } from '@/lib/i18n';

const messages = {
  en: {
    loading: 'Loading…',
    failedToLoad: 'Failed to load task',
    notFound: 'Task not found.',
    pageDescription: 'Task details and run history.',
    backToTasks: 'Back to Tasks',
    taskInfo: 'Task Info',
    prompt: 'Prompt:',
    schedule: 'Schedule:',
    enabled: 'Enabled:',
    nextRun: 'Next run:',
    lastStatus: 'Last status:',
    yes: 'yes',
    no: 'no',
    recentRuns: 'Recent Runs',
    noRuns: 'No runs yet.',
    statusCompleted: 'completed',
    statusFailed: 'failed',
    statusRunning: 'running',
    statusPending: 'pending',
  },
  'zh-TW': {
    loading: '載入中…',
    failedToLoad: '載入任務失敗',
    notFound: '找不到任務。',
    pageDescription: '任務詳細資料與執行記錄。',
    backToTasks: '返回任務',
    taskInfo: '任務資訊',
    prompt: '提示詞：',
    schedule: '排程：',
    enabled: '已啟用：',
    nextRun: '下次執行：',
    lastStatus: '上次狀態：',
    yes: '是',
    no: '否',
    recentRuns: '近期執行',
    noRuns: '尚無執行記錄。',
    statusCompleted: '已完成',
    statusFailed: '失敗',
    statusRunning: '執行中',
    statusPending: '待處理',
  },
} satisfies Messages<{
  loading: string;
  failedToLoad: string;
  notFound: string;
  pageDescription: string;
  backToTasks: string;
  taskInfo: string;
  prompt: string;
  schedule: string;
  enabled: string;
  nextRun: string;
  lastStatus: string;
  yes: string;
  no: string;
  recentRuns: string;
  noRuns: string;
  statusCompleted: string;
  statusFailed: string;
  statusRunning: string;
  statusPending: string;
}>;

function statusLabel(t: (typeof messages)['en'], status: string): string {
  switch (status) {
    case 'completed':
      return t.statusCompleted;
    case 'failed':
      return t.statusFailed;
    case 'running':
      return t.statusRunning;
    case 'pending':
      return t.statusPending;
    default:
      return status;
  }
}

interface TaskRunRow {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  output: string | null;
  tokenUsage: { inputTokens?: number; outputTokens?: number };
}

interface Task {
  id: string;
  name: string;
  prompt: string;
  schedule: unknown;
  enabled: boolean;
  lastStatus: string | null;
  nextRunAt: string | null;
}

interface TaskResponse {
  success: boolean;
  data: Task;
}

interface TaskRunsResponse {
  success: boolean;
  data: { runs: TaskRunRow[] };
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT(messages);
  const [task, setTask] = useState<Task | null>(null);
  const [runs, setRuns] = useState<TaskRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [taskResp, runsResp] = await Promise.all([
        authFetch<TaskResponse>(`/api/v1/tasks/${id}`),
        authFetch<TaskRunsResponse>(`/api/v1/tasks/${id}/runs?limit=20`),
      ]);
      setTask(taskResp.data);
      setRuns(runsResp.data.runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="p-6 text-muted-foreground">{t.loading}</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;
  if (!task) return <div className="p-6">{t.notFound}</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{task.name}</h1>
          <p className="text-sm text-muted-foreground">{t.pageDescription}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/tasks')}>
          {t.backToTasks}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.taskInfo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">{t.prompt} </span>
            {task.prompt}
          </div>
          <div>
            <span className="text-muted-foreground">{t.schedule} </span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {JSON.stringify(task.schedule)}
            </code>
          </div>
          <div>
            <span className="text-muted-foreground">{t.enabled} </span>
            {task.enabled ? t.yes : t.no}
          </div>
          <div>
            <span className="text-muted-foreground">{t.nextRun} </span>
            {task.nextRunAt ?? '—'}
          </div>
          {task.lastStatus && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t.lastStatus} </span>
              <Badge
                variant={
                  task.lastStatus === 'completed'
                    ? 'default'
                    : task.lastStatus === 'failed'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {statusLabel(t, task.lastStatus)}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.recentRuns}</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noRuns}</p>
          ) : (
            <ul className="divide-y">
              {runs.map((run) => (
                <li key={run.id} className="py-3">
                  <Link
                    href={`/tasks/${id}/runs/${run.id}`}
                    className="flex items-center justify-between hover:underline"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          run.status === 'completed'
                            ? 'default'
                            : run.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {statusLabel(t, run.status)}
                      </Badge>
                      <span className="text-sm">{new Date(run.startedAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {run.durationMs != null ? `${run.durationMs}ms` : ''}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
