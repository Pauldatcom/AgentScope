import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/data-table";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { EmptyState } from "@/components/empty-state";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type ToolOut } from "@/api";
import { useApi } from "@/hooks/useApi";
import {
  formatMs,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import { ChartTooltip } from "@/components/chart";
import {
  CHART_COLORS,
  AXIS_PROPS,
  GRID_PROPS,
} from "@/components/chart-tokens";

export function ToolsPage() {
  const [params] = useSearchParams();
  const focused = params.get("tool");
  const { data: tools, loading, error } = useApi(
    () => api.fetchTools({}),
    [],
  );

  const tool = React.useMemo(
    () => tools?.find((t) => t.name === focused) ?? null,
    [tools, focused],
  );

  const totalCalls = React.useMemo(
    () => (tools ?? []).reduce((a, t) => a + t.calls, 0),
    [tools],
  );
  const totalErrors = React.useMemo(
    () => (tools ?? []).reduce((a, t) => a + t.errors, 0),
    [tools],
  );
  const withLatency = React.useMemo(
    () => (tools ?? []).filter((t) => t.p95_ms !== null),
    [tools],
  );

  const columns: Column<ToolOut>[] = [
    {
      key: "name",
      header: "Tool",
      sortable: true,
      render: (t) => (
        <span className="font-mono text-foreground">{t.name}</span>
      ),
    },
    {
      key: "calls",
      header: "Calls",
      sortable: true,
      align: "right",
      render: (t) => (
        <span className="font-mono tabular-nums">
          {formatNumber(t.calls)}
        </span>
      ),
    },
    {
      key: "sessions",
      header: "Sessions",
      sortable: true,
      align: "right",
      render: (t) => (
        <span className="font-mono tabular-nums">
          {formatNumber(t.sessions)}
        </span>
      ),
    },
    {
      key: "error_rate",
      header: "Error rate",
      sortable: true,
      align: "right",
      render: (t) => (
        <span className="font-mono tabular-nums">
          {t.error_rate !== null ? formatPercent(t.error_rate) : "N/A"}
        </span>
      ),
    },
    {
      key: "p50_ms",
      header: "p50",
      sortable: true,
      align: "right",
      render: (t) => (
        <span className="font-mono tabular-nums">
          {t.p50_ms !== null ? formatMs(t.p50_ms) : "N/A"}
        </span>
      ),
    },
    {
      key: "p95_ms",
      header: "p95",
      sortable: true,
      align: "right",
      render: (t) => (
        <span className="font-mono tabular-nums">
          {t.p95_ms !== null ? formatMs(t.p95_ms) : "N/A"}
        </span>
      ),
    },
    {
      key: "p99_ms",
      header: "p99",
      sortable: true,
      align: "right",
      render: (t) => (
        <span className="font-mono tabular-nums">
          {t.p99_ms !== null ? formatMs(t.p99_ms) : "N/A"}
        </span>
      ),
    },
    {
      key: "avg_input_chars",
      header: "Avg input",
      align: "right",
      render: (t) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {t.avg_input_chars !== null
            ? formatNumber(t.avg_input_chars)
            : "N/A"}
        </span>
      ),
    },
    {
      key: "avg_result_chars",
      header: "Avg output",
      align: "right",
      render: (t) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {t.avg_result_chars !== null
            ? formatNumber(t.avg_result_chars)
            : "N/A"}
        </span>
      ),
    },
  ];

  const latencyData = React.useMemo(
    () =>
      (tools ?? [])
        .filter((t) => t.p95_ms !== null)
        .map((t) => ({
          name: t.name,
          p50: t.p50_ms ?? 0,
          p95: t.p95_ms ?? 0,
          p99: t.p99_ms ?? 0,
        }))
        .sort((a, b) => b.p95 - a.p95)
        .slice(0, 10),
    [tools],
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Tools"
        description="Per-tool usage, latency percentiles, and error rate."
      />

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load tools"
          description={error}
        />
      ) : !tools || tools.length === 0 ? (
        <EmptyState
          title="No tools in scope"
          description="Import a dataset with tool calls to see per-tool metrics."
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Tools"
              value={String(tools.length)}
              unit="tools"
              scope="distinct tool names"
            />
            <KpiCard
              label="Total calls"
              value={formatNumber(totalCalls)}
              unit="calls"
              scope="all tool_call rows"
            />
            <KpiCard
              label="Error rate"
              value={formatPercent(totalCalls > 0 ? totalErrors / totalCalls : 0)}
              scope="tool calls w/ known status"
            />
            <KpiCard
              label="Tools w/ latency"
              value={String(withLatency.length)}
              unit="tools"
              scope="tools reporting wall_latency_ms"
            />
          </div>

          {tool && (
            <div className="mb-5">
              <ChartCard
                title={tool.name}
                description={`Focused on ${tool.calls.toLocaleString()} calls across ${tool.sessions} sessions.`}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Calls" value={formatNumber(tool.calls)} />
                  <MiniStat
                    label="Error rate"
                    value={
                      tool.error_rate !== null
                        ? formatPercent(tool.error_rate)
                        : "N/A"
                    }
                  />
                  <MiniStat
                    label="p95 latency"
                    value={tool.p95_ms !== null ? formatMs(tool.p95_ms) : "N/A"}
                  />
                  <MiniStat
                    label="p99 latency"
                    value={tool.p99_ms !== null ? formatMs(tool.p99_ms) : "N/A"}
                  />
                </div>
              </ChartCard>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <DataTable
              columns={columns}
              rows={tools}
              rowKey={(t) => t.name}
              pageSize={12}
              initialSort={{ key: "calls", dir: "desc" }}
              emptyLabel="No tools in scope."
            />
            <ChartCard
              title="Latency by tool (p50 · p95 · p99)"
              description="Higher percentiles reveal the slowest tools."
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={latencyData}
                  margin={{ top: 4, right: 4, bottom: 0, left: -8 }}
                >
                  <CartesianGrid {...GRID_PROPS} vertical={false} />
                  <XAxis
                    dataKey="name"
                    {...AXIS_PROPS}
                    tick={{ ...AXIS_PROPS.tick, fontSize: 10 }}
                  />
                  <YAxis
                    {...AXIS_PROPS}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}s`}
                    width={44}
                  />
                  <RechartsTooltip
                    content={
                      <ChartTooltip formatter={(v) => formatMs(Number(v))} />
                    }
                  />
                  <Bar
                    dataKey="p50"
                    name="p50"
                    fill={CHART_COLORS[2]}
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="p95"
                    name="p95"
                    fill={CHART_COLORS[4]}
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="p99"
                    name="p99"
                    fill={CHART_COLORS[5]}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
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
