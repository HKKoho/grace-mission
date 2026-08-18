'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import anime from 'animejs';
import { EASING, DURATION } from '@/lib/anime';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { authFetch } from '@/lib/auth';
import { useT, type Messages } from '@/lib/i18n';

const messages = {
  en: {
    title: 'Token Usage',
    description: 'Monitor token consumption, costs, and budget utilization.',
    axisTokens: 'Tokens',
    tooltipTokens: (date: string, n: number) => `${date}: ${n.toLocaleString()} tokens`,
    noAgentData: 'No agent usage data.',
    statMonthlyBudget: 'Monthly Budget',
    statUsed: 'Used',
    statRemaining: 'Remaining',
    statUtilization: 'Utilization',
    valueUnlimited: 'Unlimited',
    valueNa: 'N/A',
    unitTokens: 'tokens',
    unitOfBudget: 'of budget',
    tabDaily: 'Daily',
    tabWeekly: 'Weekly',
    tabMonthly: 'Monthly',
    usageOverTime: 'Usage Over Time',
    usageOverTimeDesc: 'Token consumption trend for the current month.',
    noUsageData: 'No usage data for this period.',
    perUserBreakdown: 'Per-User Breakdown',
    perUserBreakdownDesc: 'Token usage and cost by user. Click a row to see agent-level details.',
    colUser: 'User',
    colInput: 'Input',
    colOutput: 'Output',
    colTotal: 'Total',
    colEstCost: 'Est. Cost',
  },
  'zh-TW': {
    title: 'Token 用量',
    description: '監測 Token 消耗、費用與預算使用情形。',
    axisTokens: 'Token',
    tooltipTokens: (date: string, n: number) => `${date}：${n.toLocaleString()} Token`,
    noAgentData: '無代理用量資料。',
    statMonthlyBudget: '每月預算',
    statUsed: '已使用',
    statRemaining: '剩餘',
    statUtilization: '使用率',
    valueUnlimited: '無上限',
    valueNa: '無',
    unitTokens: 'Token',
    unitOfBudget: '佔預算',
    tabDaily: '每日',
    tabWeekly: '每週',
    tabMonthly: '每月',
    usageOverTime: '用量趨勢',
    usageOverTimeDesc: '本月 Token 消耗趨勢。',
    noUsageData: '此期間無用量資料。',
    perUserBreakdown: '各使用者明細',
    perUserBreakdownDesc: '各使用者的 Token 用量與費用。點選列以查看代理層級細節。',
    colUser: '使用者',
    colInput: '輸入',
    colOutput: '輸出',
    colTotal: '總計',
    colEstCost: '預估費用',
  },
} satisfies Messages<{
  title: string;
  description: string;
  axisTokens: string;
  tooltipTokens: (date: string, n: number) => string;
  noAgentData: string;
  statMonthlyBudget: string;
  statUsed: string;
  statRemaining: string;
  statUtilization: string;
  valueUnlimited: string;
  valueNa: string;
  unitTokens: string;
  unitOfBudget: string;
  tabDaily: string;
  tabWeekly: string;
  tabMonthly: string;
  usageOverTime: string;
  usageOverTimeDesc: string;
  noUsageData: string;
  perUserBreakdown: string;
  perUserBreakdownDesc: string;
  colUser: string;
  colInput: string;
  colOutput: string;
  colTotal: string;
  colEstCost: string;
}>;

interface TokenSummary {
  budget: {
    maxTokenBudget: number | null;
    budgetUsd: number | null;
    unlimited: boolean;
  };
  usage: {
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEstimatedCostUsd: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

interface UserUsage {
  userId: string;
  userName: string;
  userEmail: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
}

interface AgentUsage {
  agentDefinitionId: string;
  agentName: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
}

interface DailyUsage {
  date: string;
  totalTokens: number;
  totalEstimatedCostUsd: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function UsageLineChart({ data, maxValue }: { data: DailyUsage[]; maxValue: number }) {
  const t = useT(messages);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);

  const chartHeight = 240;
  const chartWidth = 800;
  const paddingLeft = 60;
  const paddingBottom = 30;
  const paddingTop = 10;
  const paddingRight = 10;

  const drawWidth = chartWidth - paddingLeft - paddingRight;
  const drawHeight = chartHeight - paddingTop - paddingBottom;

  // Y-axis ticks (4 evenly spaced)
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxValue / 4) * i));

  // Points
  const points = data.map((d, i) => {
    const x = paddingLeft + (data.length > 1 ? (i / (data.length - 1)) * drawWidth : drawWidth / 2);
    const y = paddingTop + drawHeight - (d.totalTokens / maxValue) * drawHeight;
    return { x, y, ...d };
  });

  // SVG path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Area fill path
  const areaPath = `${linePath} L ${points[points.length - 1]!.x} ${paddingTop + drawHeight} L ${points[0]!.x} ${paddingTop + drawHeight} Z`;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (lineRef.current) {
      const length = lineRef.current.getTotalLength();
      lineRef.current.style.strokeDasharray = String(length);
      lineRef.current.style.strokeDashoffset = String(length);
      anime({
        targets: lineRef.current,
        strokeDashoffset: [length, 0],
        duration: DURATION.chart,
        easing: EASING,
      });
    }

    if (areaRef.current) {
      anime({
        targets: areaRef.current,
        opacity: [0, 0.08],
        duration: 300,
        delay: DURATION.chart,
        easing: EASING,
      });
    }
  }, [data]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="h-[280px] w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis grid lines and labels */}
        {yTicks.map((tick) => {
          const y = paddingTop + drawHeight - (tick / maxValue) * drawHeight;
          return (
            <g key={tick}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={11}
              >
                {formatCompact(tick)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path ref={areaRef} d={areaPath} fill="currentColor" fillOpacity={0} />

        {/* Line */}
        <path
          ref={lineRef}
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.6}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={4} fill="currentColor" fillOpacity={0.8}>
            <title>{t.tooltipTokens(p.date, p.totalTokens)}</title>
          </circle>
        ))}

        {/* X-axis labels */}
        {points.map((p, i) => {
          // Show first, last, and evenly spaced labels
          const showLabel =
            data.length <= 7 ||
            i === 0 ||
            i === data.length - 1 ||
            i % Math.ceil(data.length / 6) === 0;
          if (!showLabel) return null;
          return (
            <text
              key={p.date}
              x={p.x}
              y={chartHeight - 5}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={11}
            >
              {p.date.slice(5)}
            </text>
          );
        })}

        {/* Y-axis label */}
        <text
          x={12}
          y={chartHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90, 12, ${chartHeight / 2})`}
          className="fill-muted-foreground"
          fontSize={11}
        >
          {t.axisTokens}
        </text>
      </svg>
    </div>
  );
}

function UserBreakdownRow({ user }: { user: UserUsage }) {
  const t = useT(messages);
  const [agents, setAgents] = useState<AgentUsage[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadAgents = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await authFetch<AgentUsage[]>(`/api/v1/tokens/per-user/${user.userId}/agents`);
      setAgents(Array.isArray(res) ? res : []);
    } catch {
      // silently fail — row just won't expand
    }
    setLoaded(true);
  }, [user.userId, loaded]);

  return (
    <Collapsible className="group/row">
      <CollapsibleTrigger
        className="flex w-full items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-muted/50"
        onClick={() => {
          void loadAgents();
        }}
      >
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/row:rotate-90" />
        <span className="flex-1 font-medium">{user.userName}</span>
        <span className="w-24 text-right tabular-nums text-muted-foreground">
          {formatNumber(user.totalInputTokens)}
        </span>
        <span className="w-24 text-right tabular-nums text-muted-foreground">
          {formatNumber(user.totalOutputTokens)}
        </span>
        <span className="w-24 text-right tabular-nums font-medium">
          {formatNumber(user.totalTokens)}
        </span>
        <span className="w-20 text-right tabular-nums text-muted-foreground">
          {formatCost(user.totalEstimatedCostUsd)}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {agents.length === 0 && loaded ? (
          <div className="px-10 py-3 text-sm text-muted-foreground">{t.noAgentData}</div>
        ) : (
          <div className="bg-muted/30">
            {agents.map((agent) => (
              <div
                key={agent.agentDefinitionId}
                className="flex items-center gap-2 border-b border-muted px-4 py-2 text-sm last:border-b-0"
              >
                <span className="w-3.5" />
                <span className="flex-1 pl-4 text-muted-foreground">{agent.agentName}</span>
                <span className="w-24 text-right tabular-nums text-muted-foreground">
                  {formatNumber(agent.totalInputTokens)}
                </span>
                <span className="w-24 text-right tabular-nums text-muted-foreground">
                  {formatNumber(agent.totalOutputTokens)}
                </span>
                <span className="w-24 text-right tabular-nums">
                  {formatNumber(agent.totalTokens)}
                </span>
                <span className="w-20 text-right tabular-nums text-muted-foreground">
                  {formatCost(agent.totalEstimatedCostUsd)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function TokenUsagePage() {
  const t = useT(messages);
  const [period, setPeriod] = useState('daily');
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [userBreakdown, setUserBreakdown] = useState<UserUsage[]>([]);
  const [chartData, setChartData] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, usersRes, chartRes] = await Promise.all([
        authFetch<TokenSummary>('/api/v1/tokens/summary'),
        authFetch<UserUsage[]>('/api/v1/tokens/per-user'),
        authFetch<DailyUsage[]>(`/api/v1/tokens/usage-over-time?period=${period}`),
      ]);
      setSummary(summaryRes);
      setUserBreakdown(Array.isArray(usersRes) ? usersRes : []);
      setChartData(Array.isArray(chartRes) ? chartRes : []);
    } catch {
      // Data will remain empty
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const budgetTokens = summary?.budget.maxTokenBudget;
  const usedTokens = summary?.usage.totalTokens ?? 0;
  const remainingTokens =
    budgetTokens !== null && budgetTokens !== undefined ? budgetTokens - usedTokens : null;
  const utilization = budgetTokens ? ((usedTokens / budgetTokens) * 100).toFixed(1) : null;

  const stats = [
    {
      title: t.statMonthlyBudget,
      value: summary?.budget.unlimited ? t.valueUnlimited : formatNumber(budgetTokens ?? 0),
      subtitle: summary?.budget.unlimited ? '' : t.unitTokens,
    },
    { title: t.statUsed, value: formatNumber(usedTokens), subtitle: t.unitTokens },
    {
      title: t.statRemaining,
      value: remainingTokens !== null ? formatNumber(remainingTokens) : t.valueNa,
      subtitle: remainingTokens !== null ? t.unitTokens : '',
    },
    {
      title: t.statUtilization,
      value: utilization ? `${utilization}%` : t.valueNa,
      subtitle: utilization ? t.unitOfBudget : '',
    },
  ];

  // Chart: normalize daily usage to max bar height
  const maxDaily = Math.max(...chartData.map((d) => d.totalTokens), 1);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>

      {/* Budget stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
              {stat.subtitle && <p className="text-xs text-muted-foreground">{stat.subtitle}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList>
          <TabsTrigger value="daily">{t.tabDaily}</TabsTrigger>
          <TabsTrigger value="weekly">{t.tabWeekly}</TabsTrigger>
          <TabsTrigger value="monthly">{t.tabMonthly}</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="mt-4 flex flex-col gap-6">
          {/* Usage chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t.usageOverTime}</CardTitle>
              <CardDescription>{t.usageOverTimeDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  {t.noUsageData}
                </div>
              ) : (
                <UsageLineChart data={chartData} maxValue={maxDaily} />
              )}
            </CardContent>
          </Card>

          {/* Per-user breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>{t.perUserBreakdown}</CardTitle>
              <CardDescription>{t.perUserBreakdownDesc}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Header */}
              <div className="flex items-center gap-2 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
                <span className="w-3.5" />
                <span className="flex-1">{t.colUser}</span>
                <span className="w-24 text-right">{t.colInput}</span>
                <span className="w-24 text-right">{t.colOutput}</span>
                <span className="w-24 text-right">{t.colTotal}</span>
                <span className="w-20 text-right">{t.colEstCost}</span>
              </div>
              {userBreakdown.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {t.noUsageData}
                </div>
              ) : (
                userBreakdown.map((user) => <UserBreakdownRow key={user.userId} user={user} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
