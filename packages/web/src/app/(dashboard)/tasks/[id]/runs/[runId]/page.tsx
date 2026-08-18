'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useT, type Messages } from '@/lib/i18n';

const i18n = {
  en: {
    loading: 'Loading…',
    failedToLoad: 'Failed to load run.',
    errorPrefix: 'Error:',
    notFound: 'Run not found.',
    run: 'Run',
    backToTask: 'Back to Task',
    summary: 'Summary',
    started: 'Started:',
    completed: 'Completed:',
    duration: 'Duration:',
    tokens: 'Tokens:',
    tokensValue: (input: number, output: number) => `in ${input} / out ${output}`,
    error: 'Error:',
    transcript: 'Transcript',
    noMessages: 'No messages recorded.',
    statusCompleted: 'completed',
    statusFailed: 'failed',
    statusRunning: 'running',
    statusPending: 'pending',
  },
  'zh-TW': {
    loading: '載入中…',
    failedToLoad: '載入執行記錄失敗。',
    errorPrefix: '錯誤：',
    notFound: '找不到執行記錄。',
    run: '執行',
    backToTask: '返回任務',
    summary: '摘要',
    started: '開始時間：',
    completed: '完成時間：',
    duration: '耗時：',
    tokens: 'Token：',
    tokensValue: (input: number, output: number) => `輸入 ${input} / 輸出 ${output}`,
    error: '錯誤：',
    transcript: '對話記錄',
    noMessages: '尚無記錄訊息。',
    statusCompleted: '已完成',
    statusFailed: '失敗',
    statusRunning: '執行中',
    statusPending: '待處理',
  },
} satisfies Messages<{
  loading: string;
  failedToLoad: string;
  errorPrefix: string;
  notFound: string;
  run: string;
  backToTask: string;
  summary: string;
  started: string;
  completed: string;
  duration: string;
  tokens: string;
  tokensValue: (input: number, output: number) => string;
  error: string;
  transcript: string;
  noMessages: string;
  statusCompleted: string;
  statusFailed: string;
  statusRunning: string;
  statusPending: string;
}>;

function statusLabel(t: (typeof i18n)['en'], status: string): string {
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

interface RunMessage {
  id: string;
  role: string;
  content: string;
  ordering: number;
  toolCallId: string | null;
  toolCalls: unknown;
}

interface Run {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  output: string | null;
  error: string | null;
  tokenUsage: { inputTokens?: number; outputTokens?: number };
}

interface MessagesResponse {
  success: boolean;
  data: { run: Run; messages: RunMessage[] };
}

export default function RunDetailPage() {
  const { id, runId } = useParams<{ id: string; runId: string }>();
  const router = useRouter();
  const t = useT(i18n);
  const [run, setRun] = useState<Run | null>(null);
  const [messages, setMessages] = useState<RunMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const resp = await authFetch<MessagesResponse>(`/api/v1/tasks/${id}/runs/${runId}/messages`);
      setRun(resp.data.run);
      setMessages(resp.data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [id, runId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="p-6 text-muted-foreground">{t.loading}</div>;
  if (error)
    return (
      <div className="p-6 text-destructive">
        {t.errorPrefix} {error}
      </div>
    );
  if (!run) return <div className="p-6">{t.notFound}</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{t.run}</h1>
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
        </div>
        <Button variant="outline" onClick={() => router.push(`/tasks/${id}`)}>
          {t.backToTask}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.summary}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">{t.started} </span>
            {new Date(run.startedAt).toLocaleString()}
          </div>
          <div>
            <span className="text-muted-foreground">{t.completed} </span>
            {run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}
          </div>
          <div>
            <span className="text-muted-foreground">{t.duration} </span>
            {run.durationMs != null ? `${run.durationMs}ms` : '—'}
          </div>
          <div>
            <span className="text-muted-foreground">{t.tokens} </span>
            {t.tokensValue(run.tokenUsage?.inputTokens ?? 0, run.tokenUsage?.outputTokens ?? 0)}
          </div>
          {run.error && (
            <div className="text-destructive">
              <span className="text-muted-foreground">{t.error} </span>
              {run.error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.transcript}</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noMessages}</p>
          ) : (
            <ul className="space-y-3">
              {messages.map((msg) => (
                <li key={msg.id} className="rounded border border-border p-3">
                  <div className="mb-1 text-xs uppercase text-muted-foreground">{msg.role}</div>
                  <pre className="whitespace-pre-wrap text-sm">{msg.content}</pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
