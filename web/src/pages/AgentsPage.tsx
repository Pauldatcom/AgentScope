import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, ArrowRight, AlertCircle } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/data-table";
import { KpiCard, KpiCardSkeleton } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { EmptyState } from "@/components/empty-state";
import { useApi } from "@/hooks/useApi";
import { api, type AgentOut, type SourceOut } from "@/api";
import {
  formatDuration,
  formatNumber,
  formatPercent,
  formatTokens,
  relativeTime,
} from "@/lib/utils";

export function AgentsPage() {
  const navigate = useNavigate();
  const { data: agentsData, loading, error, refetch } = useApi<AgentOut[]>(
    () => api.fetchAgents({}),
    [],
  );
  const { data: sourcesData } = useApi<SourceOut[]>(
    () => api.fetchSources(),
    [],
  );

  const agents = React.useMemo(() => agentsData ?? [], [agentsData]);

  const totalSessions = React.useMemo(
    () => agents.reduce((acc, a) => acc + a.sessions, 0),
    [agents],
  );
  const totalTokens = React.useMemo(
    () => agents.reduce((acc, a) => acc + (a.total_tokens ?? 0), 0),
    [agents],
  );
  const totalErrors = React.useMemo(
    () => agents.reduce((acc, a) => acc + a.errors, 0),
    [agents],
  );

  const columns: Column<AgentOut>[] = [
    {
      key: "name",
      header: "Agent",
      sortable: true,
      render: (a) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Boxes className="h-3.5 w-3.5" />
          </div>
          <div className="font-medium text-foreground">{a.name}</div>
        </div>
      ),
    },
    {
      key: "sessions",
      header: "Sessions",
      sortable: true,
      align: "right",
      render: (a) => (
        <span className="font-mono tabular-nums">{formatNumber(a.sessions)}</span>
      ),
    },
    {
      key: "total_tokens",
      header: "Tokens",
      sortable: true,
      align: "right",
      render: (a) => (
        <span className="font-mono tabular-nums">
          {a.total_tokens !== null ? formatTokens(a.total_tokens) : "N/A"}
        </span>
      ),
    },
    {
      key: "tool_calls",
      header: "Tool calls",
      sortable: true,
      align: "right",
      render: (a) => (
        <span className="font-mono tabular-nums">{formatNumber(a.tool_calls)}</span>
      ),
    },
    {
      key: "error_rate",
      header: "Error rate",
      sortable: true,
      align: "right",
      render: (a) => (
        <span className="font-mono tabular-nums">
          {a.error_rate !== null ? formatPercent(a.error_rate) : "N/A"}
        </span>
      ),
    },
    {
      key: "cache_rate",
      header: "Cache rate",
      sortable: true,
      align: "right",
      render: (a) => (
        <span className="font-mono tabular-nums">
          {a.cache_rate !== null ? formatPercent(a.cache_rate) : "N/A"}
        </span>
      ),
    },
    {
      key: "avg_duration_ms",
      header: "Avg duration",
      sortable: true,
      align: "right",
      render: (a) => (
        <span className="font-mono tabular-nums">
          {a.avg_duration_ms !== null
            ? formatDuration(a.avg_duration_ms)
            : "N/A"}
        </span>
      ),
    },
    {
      key: "last_active_iso",
      header: "Last active",
      sortable: true,
      align: "right",
      render: (a) => (
        <span className="text-muted-foreground">
          {relativeTime(a.last_active_iso)}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Agents"
        description={
          sourcesData
            ? `Per-agent breakdown across ${sourcesData.length} connected ${
                sourcesData.length === 1 ? "source" : "sources"
              }.`
            : "Per-agent breakdown across all connected sources."
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {error ? null : loading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="Agents"
              value={String(agents.length)}
              unit="agents"
              scope="distinct agent names"
            />
            <KpiCard
              label="Sessions"
              value={formatNumber(totalSessions)}
              unit="sessions"
              scope="across all agents"
            />
            <KpiCard
              label="Total tokens"
              value={formatTokens(totalTokens)}
              unit="tokens"
              scope="all model calls"
            />
            <KpiCard
              label="Error rate"
              value={formatPercent(
                totalSessions > 0 ? totalErrors / totalSessions : null,
              )}
              scope="sessions w/ known status"
            />
          </>
        )}
      </div>
      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-6 py-14 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Failed to load agents
            </h3>
            <p className="mx-auto max-w-md text-xs text-muted-foreground">
              {error}
            </p>
          </div>
          <button
            type="button"
            onClick={refetch}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/80 bg-card/60 px-6 py-14 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Boxes className="h-5 w-5 animate-pulse" />
          </div>
          <p className="text-xs text-muted-foreground">Loading agents…</p>
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No agents yet"
          description="Import a dataset to populate the agent catalog."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={agents}
            rowKey={(a) => a.name}
            onRowClick={(a) => navigate(`/sessions?agent=${a.name}&period=all`)}
            pageSize={12}
            initialSort={{ key: "sessions", dir: "desc" }}
          />
          <div className="mt-5">
            <ChartCard
              title="Sessions per agent"
              description="Click a row above to view that agent's sessions."
            >
              <div className="flex flex-wrap gap-2">
                {agents.map((a) => (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() =>
                      navigate(`/sessions?agent=${a.name}&period=all`)
                    }
                    className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-xs transition-colors hover:border-border hover:bg-muted/40"
                  >
                    <span className="font-medium text-foreground">{a.name}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {a.sessions}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
