import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Scatter,
  ScatterChart,
  ZAxis,
} from "recharts";
import { ArrowRight, Zap } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { FiltersBar } from "@/components/filters-bar";
import { KpiCard, KpiCardSkeleton } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { ActivityGrid, type ActivityCellData } from "@/components/activity-grid";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChartTooltip } from "@/components/chart";
import {
  CHART_COLORS,
  AXIS_PROPS,
  GRID_PROPS,
} from "@/components/chart-tokens";
import {
  api,
  type DashboardOut,
  type SessionOut,
  type ActivityBucketOut,
  type ToolOut,
  type ModelOut,
} from "@/api";
import { type Filters, DEFAULT_FILTERS, isInPeriod, periodCutoffMs } from "@/types";
import { useApi } from "@/hooks/useApi";
import {
  formatDuration,
  formatNumber,
  formatPercent,
  formatTokens,
} from "@/lib/utils";

const FLAT_DELTA = { pct: null, sign: "flat" as const, good: false };

function defOf(
  definitions: DashboardOut["definitions"],
  id: string,
): string | undefined {
  const d = definitions[id];
  if (!d) return undefined;
  return d.missing || d.calc;
}

function OverviewKpis({ data }: { data: DashboardOut }) {
  const ind = data.indicators;
  const sessions = ind.error_rate.total;
  const totalTokens = ind.tokens_by_model.reduce(
    (a, m) => a + m.total_tokens,
    0,
  );
  const avgDur = ind.avg_duration.avg_ms;
  const toolCalls = ind.tool_distribution.reduce((a, t) => a + t.count, 0);
  const errorRate = ind.error_rate.rate;
  const cacheRate = ind.cache_rate.rate;
  const def = (id: string) => defOf(data.definitions, id);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="Sessions"
        value={formatNumber(sessions)}
        unit="sessions"
        delta={FLAT_DELTA}
        scope="session rows"
        definition={def("sessions")}
      />
      <KpiCard
        label="Total tokens"
        value={formatTokens(totalTokens)}
        unit="tokens"
        delta={FLAT_DELTA}
        scope="model_call rows"
        definition={def("tokens")}
      />
      <KpiCard
        label="Avg duration"
        value={avgDur !== null ? formatDuration(Math.round(avgDur)) : "N/A"}
        delta={FLAT_DELTA}
        scope="sessions w/ start & end"
        definition={def("avg_duration")}
      />
      <KpiCard
        label="Tool calls"
        value={formatNumber(toolCalls)}
        unit="calls"
        delta={FLAT_DELTA}
        scope="tool_call rows"
        definition={def("tool_calls")}
      />
      <KpiCard
        label="Error rate"
        value={errorRate === null ? "N/A" : formatPercent(errorRate)}
        delta={FLAT_DELTA}
        scope="sessions w/ known status"
        definition={def("error_rate")}
      />
      <KpiCard
        label="Cache hit rate"
        value={cacheRate === null ? "N/A" : formatPercent(cacheRate)}
        delta={FLAT_DELTA}
        scope="model_call rows w/ cache field"
        definition={def("cache_rate")}
        notComparable
      />
    </div>
  );
}

function ActivityTimelineCard({
  buckets,
}: {
  buckets: ActivityBucketOut[];
}) {
  const navigate = useNavigate();
  const cells: ActivityCellData[] = React.useMemo(
    () =>
      buckets.map((b) => ({
        date: b.bucket,
        label: new Date(b.bucket).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        sessions: b.sessions,
        tokens: b.total_tokens,
        toolCalls: b.tool_calls,
        errors: b.errors,
      })),
    [buckets],
  );
  return (
    <ChartCard
      title="Agent activity"
      description="Sessions per day — click a cell to drill in"
      badge="GitHub-style"
      action={
        <Tabs defaultValue="sessions">
          <TabsList className="h-7">
            <TabsTrigger value="sessions" className="px-2 py-0 text-[10px]">
              Sessions
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <ActivityGrid
        cells={cells}
        metric="sessions"
        onCellClick={(cell) =>
          navigate(`/sessions?period=24h&from=${cell.date}`)
        }
      />
    </ChartCard>
  );
}

function TopModelUsageCard({ models }: { models: ModelOut[] }) {
  const navigate = useNavigate();
  const [metric, setMetric] = React.useState<"tokens" | "requests">("tokens");
  const sorted = React.useMemo(
    () =>
      [...models]
        .filter((m) =>
          metric === "tokens" ? m.total_tokens !== null : m.requests !== null,
        )
        .sort((a, b) => {
          if (metric === "tokens")
            return (b.total_tokens ?? 0) - (a.total_tokens ?? 0);
          return (b.requests ?? 0) - (a.requests ?? 0);
        })
        .slice(0, 8),
    [models, metric],
  );
  const max = Math.max(
    ...sorted.map((m) =>
      metric === "tokens" ? m.total_tokens ?? 0 : m.requests ?? 0,
    ),
    1,
  );
  const fmt = (v: number) =>
    metric === "tokens" ? formatTokens(v) : formatNumber(v);
  return (
    <ChartCard
      title="Top model usage"
      description={`${sorted.length} models · ${metric}`}
      badge="top models"
      action={
        <div className="flex items-center gap-1 rounded-md border border-border/80 p-0.5">
          {(["tokens", "requests"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={
                "rounded px-2 py-1 text-[11px] font-medium transition-colors " +
                (metric === m
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {sorted.map((m, i) => {
          const v = metric === "tokens" ? m.total_tokens ?? 0 : m.requests ?? 0;
          return (
            <button
              key={m.name}
              type="button"
              onClick={() => navigate(`/models?model=${m.name}`)}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40"
            >
              <span className="w-4 text-right text-[10px] text-muted-foreground">
                {i + 1}
              </span>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="w-36 truncate text-left text-xs font-medium text-foreground">
                {m.name}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted/40">
                <div
                  className="absolute inset-y-0 left-0 rounded transition-all"
                  style={{
                    width: `${(v / max) * 100}%`,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                    opacity: 0.85,
                  }}
                />
              </div>
              <span className="w-16 text-right font-mono text-xs tabular-nums text-foreground">
                {fmt(v)}
              </span>
              <span className="w-16 text-right text-[10px] text-muted-foreground">
                {m.sessions} sess
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          );
        })}
      </div>
    </ChartCard>
  );
}

function TokenConsumptionChart({
  buckets,
}: {
  buckets: ActivityBucketOut[];
}) {
  const data = React.useMemo(
    () =>
      buckets.map((t) => ({
        date: t.bucket,
        label: new Date(t.bucket).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        prompt: t.prompt_tokens,
        completion: t.completion_tokens,
        cache: t.cache_tokens,
      })),
    [buckets],
  );
  return (
    <ChartCard
      title="Token consumption"
      description="Prompt vs completion vs cache tokens over time"
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="gPrompt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.6} />
              <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gComp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[2]} stopOpacity={0.6} />
              <stop offset="100%" stopColor={CHART_COLORS[2]} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gCache" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[4]} stopOpacity={0.6} />
              <stop offset="100%" stopColor={CHART_COLORS[4]} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis
            {...AXIS_PROPS}
            tickFormatter={(v) => formatTokens(v)}
            width={48}
          />
          <RechartsTooltip
            content={
              <ChartTooltip
                formatter={(v) => formatTokens(Number(v))}
                labelFormatter={(l) => l}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="prompt"
            name="Prompt"
            stackId="1"
            stroke={CHART_COLORS[0]}
            fill="url(#gPrompt)"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="completion"
            name="Completion"
            stackId="1"
            stroke={CHART_COLORS[2]}
            fill="url(#gComp)"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="cache"
            name="Cache"
            stackId="1"
            stroke={CHART_COLORS[4]}
            fill="url(#gCache)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ToolDistributionCard({ tools }: { tools: ToolOut[] }) {
  const navigate = useNavigate();
  const data = React.useMemo(
    () =>
      tools
        .map((t) => ({ name: t.name, value: t.calls }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    [tools],
  );
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  return (
    <ChartCard
      title="Tools used"
      description="Distribution of tool calls in scope"
      action={
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => navigate("/tools")}
        >
          All tools <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      }
    >
      {data.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No tool calls in scope"
          description="Adjust filters or import more sessions."
        />
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="48%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={80}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                content={
                  <ChartTooltip
                    formatter={(v) => `${formatNumber(Number(v))} calls`}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-1 flex-col gap-1.5">
            {data.slice(0, 6).map((d, i) => (
              <button
                key={d.name}
                type="button"
                onClick={() => navigate(`/tools?tool=${d.name}`)}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted/40"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="flex-1 text-left text-foreground">
                  {d.name}
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {formatNumber(d.value)}
                </span>
                <span className="w-10 text-right text-muted-foreground/70">
                  {Math.round((d.value / total) * 100)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function SessionDurationStatusCard({
  sessions,
}: {
  sessions: SessionOut[];
}) {
  const navigate = useNavigate();
  const data = React.useMemo(
    () =>
      sessions
        .filter((s) => s.duration_ms !== null && s.total_tokens !== null)
        .slice(0, 80)
        .map((s) => ({
          id: s.id,
          duration: (s.duration_ms ?? 0) / 1000,
          tokens: s.total_tokens ?? 0,
          status: s.status,
        })),
    [sessions],
  );
  const colorByStatus: Record<string, string> = {
    completed: CHART_COLORS[2],
    completed_with_errors: CHART_COLORS[4],
    error: CHART_COLORS[5],
    aborted: CHART_COLORS[1],
    running: CHART_COLORS[3],
  };
  return (
    <ChartCard
      title="Session duration vs status"
      description="Each point is a session — color = status, size = tokens. Click a point to inspect."
    >
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="duration"
            name="Duration"
            unit="s"
            {...AXIS_PROPS}
            tickFormatter={(v) => `${Math.round(v)}s`}
          />
          <YAxis
            dataKey="tokens"
            name="Tokens"
            {...AXIS_PROPS}
            tickFormatter={(v) => formatTokens(v)}
            width={50}
          />
          <ZAxis dataKey="tokens" range={[40, 400]} />
          <RechartsTooltip
            cursor={{ stroke: "hsl(var(--border))" }}
            content={
              <ChartTooltip
                formatter={(v, name) =>
                  name === "Tokens"
                    ? formatTokens(Number(v))
                    : `${Math.round(Number(v))}s`
                }
              />
            }
          />
          {Object.entries(colorByStatus).map(([status, color]) => (
            <Scatter
              key={status}
              data={data.filter((d) => d.status === status)}
              fill={color}
              fillOpacity={0.7}
              onClick={(payload: { id?: string }) =>
                payload?.id && navigate(`/sessions/${payload.id}`)
              }
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(colorByStatus).map(([status, color]) => (
          <div
            key={status}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: color }}
            />
            {status.replace(/_/g, " ")}
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function DataQualitySection({
  sessions,
  dashboard,
}: {
  sessions: SessionOut[];
  dashboard: DashboardOut;
}) {
  const total = sessions.length || 1;
  const complete = sessions.filter((s) => s.quality === "complete").length;
  const partial = sessions.filter((s) => s.quality === "partial").length;
  const incomplete = sessions.filter((s) => s.quality === "incomplete").length;
  const withTokens = sessions.filter((s) => s.total_tokens !== null).length;
  const withDuration = sessions.filter((s) => s.duration_ms !== null).length;
  const withErrors = sessions.filter((s) => s.errors > 0).length;
  const ind = dashboard.indicators;
  const withCache = ind.cache_rate.with_cache;
  const pct = (n: number) => formatPercent(n / total);
  const rows: {
    label: string;
    value: number;
    tone: "success" | "warning" | "destructive";
  }[] = [
    { label: "Complete sessions", value: complete, tone: "success" },
    { label: "Partial (missing fields)", value: partial, tone: "warning" },
    {
      label: "Incomplete (non-comparable)",
      value: incomplete,
      tone: "destructive",
    },
  ];
  const coverage: { label: string; value: number; def: string }[] = [
    {
      label: "Tokens coverage",
      value: withTokens,
      def: "Sessions with both prompt + completion tokens.",
    },
    {
      label: "Duration coverage",
      value: withDuration,
      def: "Sessions with non-null start & end timestamps.",
    },
    {
      label: "Cache coverage",
      value: withCache,
      def: "Sessions where the model reports cache tokens.",
    },
    {
      label: "Error coverage",
      value: withErrors,
      def: "Sessions with at least one recorded error event.",
    },
  ];
  return (
    <ChartCard
      title="Data quality"
      description="Completeness, missing fields, and comparability for the selected scope"
      action={
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => (window.location.hash = "#/data-quality")}
        >
          Open <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Quality distribution
          </div>
          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-foreground">
                  <Badge variant={r.tone}>{r.label}</Badge>
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {formatNumber(r.value)} · {pct(r.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3 md:col-span-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Field coverage
          </div>
          <div className="flex flex-col gap-2.5">
            {coverage.map((c) => (
              <TooltipProvider key={c.label}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3">
                      <span className="w-32 text-xs text-foreground">
                        {c.label}
                      </span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-primary"
                          style={{ width: `${(c.value / total) * 100}%` }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {formatNumber(c.value)} / {formatNumber(total)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{c.def}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

export function OverviewPage() {
  const [filters, setFilters] = React.useState<Filters>({ ...DEFAULT_FILTERS });

  const apiFilters = {
    source_id: filters.sourceId !== "all" ? filters.sourceId : undefined,
    agent: filters.agent !== "all" ? filters.agent : undefined,
    model: filters.model !== "all" ? filters.model : undefined,
  };

  const {
    data: dashboard,
    loading: dashLoading,
    error: dashError,
  } = useApi(() => api.fetchDashboard(apiFilters), [
    filters.sourceId,
    filters.agent,
    filters.model,
  ]);
  const {
    data: buckets,
    loading: actLoading,
    error: actError,
  } = useApi(() => api.fetchActivity(apiFilters), [
    filters.sourceId,
    filters.agent,
    filters.model,
  ]);
  const {
    data: tools,
    loading: toolsLoading,
    error: toolsError,
  } = useApi(() => api.fetchTools(apiFilters), [
    filters.sourceId,
    filters.agent,
    filters.model,
  ]);
  const {
    data: models,
    loading: modelsLoading,
    error: modelsError,
  } = useApi(() => api.fetchModels(apiFilters), [
    filters.sourceId,
    filters.agent,
    filters.model,
  ]);
  const {
    data: sessions,
    loading: sessLoading,
    error: sessError,
  } = useApi(
    () => api.fetchSessions({ ...apiFilters, limit: 10000 }),
    [filters.sourceId, filters.agent, filters.model],
  );

  const loading =
    dashLoading || actLoading || toolsLoading || modelsLoading || sessLoading;
  const error =
    dashError || actError || toolsError || modelsError || sessError;

  const visibleSessions = React.useMemo(
    () => (sessions ?? []).filter((s) => isInPeriod(s.started_at, filters.period)),
    [sessions, filters.period],
  );
  const visibleBuckets = React.useMemo(() => {
    const cutoff = periodCutoffMs(filters.period);
    if (cutoff === null) return buckets ?? [];
    return (buckets ?? []).filter((b) => {
      const ts = Date.parse(b.bucket);
      return !Number.isNaN(ts) && ts >= cutoff;
    });
  }, [buckets, filters.period]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Overview"
        description="High-level observability across all your AI coding agents."
      />
      <FiltersBar filters={filters} onChange={setFilters} className="mb-5" />
      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {range(6).map((i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={Zap}
          title="Couldn't load overview"
          description={error}
        />
      ) : !dashboard ? (
        <EmptyState
          icon={Zap}
          title="No data"
          description="No dashboard data available for the selected filters."
        />
      ) : (
        <>
          <OverviewKpis data={dashboard} />
          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            <div className="xl:col-span-2 flex flex-col gap-3">
              <ActivityTimelineCard buckets={visibleBuckets} />
              <div className="grid gap-3 md:grid-cols-2">
                <TokenConsumptionChart buckets={visibleBuckets} />
                <ToolDistributionCard tools={tools ?? []} />
              </div>
              <SessionDurationStatusCard sessions={visibleSessions} />
            </div>
            <div className="flex flex-col gap-3">
              <TopModelUsageCard models={models ?? []} />
              <DataQualitySection
                sessions={visibleSessions}
                dashboard={dashboard}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
