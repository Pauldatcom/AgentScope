import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { Boxes } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/data-table";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type ModelOut } from "@/api";
import { useApi } from "@/hooks/useApi";
import {
  formatMs,
  formatNumber,
  formatPercent,
  formatTokens,
} from "@/lib/utils";
import { ChartTooltip } from "@/components/chart";
import {
  CHART_COLORS,
  AXIS_PROPS,
  GRID_PROPS,
} from "@/components/chart-tokens";

export function ModelsPage() {
  const [params] = useSearchParams();
  const [metric, setMetric] = React.useState<"tokens" | "requests">("tokens");
  const focused = params.get("model");

  const { data: models, loading, error } = useApi(
    () => api.fetchModels({}),
    [],
  );

  const totalTokens = (models ?? []).reduce(
    (a, m) => a + (m.total_tokens ?? 0),
    0,
  );
  const totalRequests = (models ?? []).reduce(
    (a, m) => a + (m.requests ?? 0),
    0,
  );

  const focusedModel = (models ?? []).find((m) => m.name === focused);

  const columns: Column<ModelOut>[] = [
    {
      key: "name",
      header: "Model",
      sortable: true,
      render: (m) => (
        <div>
          <div className="font-mono text-foreground">{m.name}</div>
        </div>
      ),
    },
    {
      key: "sessions",
      header: "Sessions",
      sortable: true,
      align: "right",
      render: (m) => (
        <span className="font-mono tabular-nums">
          {formatNumber(m.sessions)}
        </span>
      ),
    },
    {
      key: "requests",
      header: "Requests",
      sortable: true,
      align: "right",
      render: (m) => (
        <span className="font-mono tabular-nums">
          {formatNumber(m.requests)}
        </span>
      ),
    },
    {
      key: "total_tokens",
      header: "Tokens",
      sortable: true,
      align: "right",
      render: (m) => (
        <span className="font-mono tabular-nums">
          {m.total_tokens !== null ? formatTokens(m.total_tokens) : "N/A"}
        </span>
      ),
    },
    {
      key: "prompt_tokens",
      header: "Prompt",
      align: "right",
      render: (m) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {m.prompt_tokens !== null ? formatTokens(m.prompt_tokens) : "N/A"}
        </span>
      ),
    },
    {
      key: "completion_tokens",
      header: "Completion",
      align: "right",
      render: (m) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {m.completion_tokens !== null
            ? formatTokens(m.completion_tokens)
            : "N/A"}
        </span>
      ),
    },
    {
      key: "cache_tokens",
      header: "Cache",
      align: "right",
      render: (m) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {m.cache_tokens !== null ? formatTokens(m.cache_tokens) : "N/A"}
        </span>
      ),
    },
    {
      key: "avg_latency_ms",
      header: "p50 latency",
      sortable: true,
      align: "right",
      render: (m) => (
        <span className="font-mono tabular-nums">
          {m.avg_latency_ms !== null ? formatMs(m.avg_latency_ms) : "N/A"}
        </span>
      ),
    },
    {
      key: "error_rate",
      header: "Error rate",
      sortable: true,
      align: "right",
      render: (m) => (
        <span className="font-mono tabular-nums">
          {m.error_rate !== null ? formatPercent(m.error_rate) : "N/A"}
        </span>
      ),
    },
    {
      key: "cache_rate",
      header: "Cache rate",
      align: "right",
      render: (m) => (
        <span className="font-mono tabular-nums">
          {m.cache_rate !== null ? formatPercent(m.cache_rate) : "N/A"}
        </span>
      ),
    },
  ];

  const chartData = [...(models ?? [])]
    .sort((a, b) => {
      if (metric === "tokens") {
        return (b.total_tokens ?? 0) - (a.total_tokens ?? 0);
      }
      return (b.requests ?? 0) - (a.requests ?? 0);
    })
    .slice(0, 10)
    .map((m) => ({
      name: m.name,
      value:
        metric === "tokens"
          ? (m.total_tokens ?? 0)
          : (m.requests ?? 0),
    }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Models"
        description="Per-model token usage, latency, and cache hit rate."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Models"
          value={String((models ?? []).length)}
          unit="models"
          scope="distinct model names"
        />
        <KpiCard
          label="Total tokens"
          value={formatTokens(totalTokens)}
          unit="tokens"
          scope="all model calls"
        />
        <KpiCard
          label="Total requests"
          value={formatNumber(totalRequests)}
          unit="requests"
          scope="model_call rows"
        />
      </div>

      {focusedModel && (
        <div className="mb-5">
          <ChartCard
            title={focusedModel.name}
            description={`${focusedModel.sessions} sessions · ${focusedModel.requests} requests`}
            action={<Badge variant="outline">{focusedModel.name}</Badge>}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat
                label="Tokens"
                value={
                  focusedModel.total_tokens !== null
                    ? formatTokens(focusedModel.total_tokens)
                    : "N/A"
                }
              />
              <MiniStat
                label="Requests"
                value={formatNumber(focusedModel.requests)}
              />
              <MiniStat
                label="Cache rate"
                value={
                  focusedModel.cache_rate !== null
                    ? formatPercent(focusedModel.cache_rate)
                    : "N/A"
                }
              />
              <MiniStat
                label="p50 latency"
                value={
                  focusedModel.avg_latency_ms !== null
                    ? formatMs(focusedModel.avg_latency_ms)
                    : "N/A"
                }
              />
            </div>
          </ChartCard>
        </div>
      )}

      {loading ? (
        <EmptyState
          icon={Boxes}
          title="Loading…"
          description="Fetching models from the API."
        />
      ) : error ? (
        <EmptyState
          icon={Boxes}
          title="Failed to load models"
          description={error}
        />
      ) : (models ?? []).length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No models in scope"
          description="Import a dataset to populate the model catalog."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable
            columns={columns}
            rows={models ?? []}
            rowKey={(m) => m.name}
            pageSize={10}
            initialSort={{ key: "total_tokens", dir: "desc" }}
            emptyLabel="No models in scope."
          />
          <ChartCard
            title={`Top models by ${metric}`}
            description="Toggle the metric to rank models differently."
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
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
              >
                <CartesianGrid {...GRID_PROPS} horizontal={false} />
                <XAxis
                  type="number"
                  {...AXIS_PROPS}
                  tickFormatter={(v: number) =>
                    metric === "tokens"
                      ? formatTokens(v)
                      : formatNumber(v)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  {...AXIS_PROPS}
                  tick={{ ...AXIS_PROPS.tick, fontSize: 10 }}
                  width={120}
                />
                <RechartsTooltip
                  content={
                    <ChartTooltip
                      formatter={(v) =>
                        metric === "tokens"
                          ? formatTokens(Number(v))
                          : formatNumber(Number(v))
                      }
                    />
                  }
                  cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                />
                <Bar dataKey="value" name={metric} radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
