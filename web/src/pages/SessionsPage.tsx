import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScrollText } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { FiltersBar } from "@/components/filters-bar";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, QualityBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/empty-state";
import { api, type SessionOut } from "@/api";
import { type Filters, type SessionStatus, type DataQuality } from "@/types";
import {
  formatDuration,
  formatNumber,
  formatDate,
  formatTokens,
} from "@/lib/utils";
import { useApi } from "@/hooks/useApi";

const PERIOD_DAYS: Record<Filters["period"], number | null> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  all: null,
};

export function SessionsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filters, setFilters] = React.useState<Filters>({
    sourceId: (params.get("source") as string) || "all",
    agent: (params.get("agent") as string) || "all",
    model: (params.get("model") as string) || "all",
    status: (params.get("status") as Filters["status"]) || "all",
    period: (params.get("period") as Filters["period"]) || "7d",
  });

  const { data, loading, error } = useApi(
    () =>
      api.fetchSessions({
        source_id: filters.sourceId !== "all" ? filters.sourceId : undefined,
        agent: filters.agent !== "all" ? filters.agent : undefined,
        model: filters.model !== "all" ? filters.model : undefined,
        limit: 10000,
      }),
    [filters.sourceId, filters.agent, filters.model],
  );

  const sessions = React.useMemo(() => {
    const rows = data ?? [];
    const days = PERIOD_DAYS[filters.period];
    const cutoff =
      days !== null ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
    return rows.filter((s) => {
      if (filters.status !== "all" && s.status !== filters.status) {
        return false;
      }
      if (cutoff !== null) {
        if (s.started_at === null) return false;
        const ts = Date.parse(s.started_at);
        if (Number.isNaN(ts) || ts < cutoff) return false;
      }
      return true;
    });
  }, [data, filters.status, filters.period]);

  const columns: Column<SessionOut>[] = [
    {
      key: "id",
      header: "Session ID",
      sortable: true,
      render: (s) => (
        <button
          type="button"
          onClick={() => navigate(`/sessions/${s.id}`)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {s.id}
        </button>
      ),
    },
    {
      key: "started_at",
      header: "Date",
      sortable: true,
      render: (s) => (
        <span className="text-muted-foreground">
          {formatDate(s.started_at)}
        </span>
      ),
    },
    {
      key: "agent",
      header: "Agent",
      sortable: true,
      render: (s) =>
        s.agent ? (
          <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[11px] text-secondary-foreground">
            {s.agent}
          </span>
        ) : (
          <span className="text-muted-foreground/60">N/A</span>
        ),
    },
    {
      key: "model",
      header: "Model",
      sortable: true,
      render: (s) =>
        s.model ? (
          <span className="font-mono text-[11px] text-foreground">
            {s.model}
          </span>
        ) : (
          <span className="text-muted-foreground/60">N/A</span>
        ),
    },
    {
      key: "source_id",
      header: "Source",
      sortable: true,
      render: (s) => (
        <span className="font-mono text-xs text-muted-foreground">
          {s.source_id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "duration_ms",
      header: "Duration",
      sortable: true,
      align: "right",
      render: (s) => (
        <span className="font-mono tabular-nums text-foreground">
          {s.duration_ms !== null ? formatDuration(s.duration_ms) : "N/A"}
        </span>
      ),
    },
    {
      key: "total_tokens",
      header: "Tokens",
      sortable: true,
      align: "right",
      render: (s) => (
        <span className="font-mono tabular-nums text-foreground">
          {s.total_tokens !== null ? formatTokens(s.total_tokens) : "N/A"}
        </span>
      ),
    },
    {
      key: "tool_calls",
      header: "Tools",
      sortable: true,
      align: "right",
      render: (s) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatNumber(s.tool_calls)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "left",
      render: (s) => (
        <StatusBadge status={s.status as SessionStatus} />
      ),
    },
    {
      key: "quality",
      header: "Quality",
      render: (s) => (
        <QualityBadge quality={s.quality as DataQuality} />
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sessions"
        description={
          loading
            ? "Loading sessions…"
            : error
              ? "Failed to load sessions."
              : `${sessions.length} sessions matching the current filters.`
        }
      />
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        className="mb-5"
      />
      {loading ? (
        <EmptyState
          icon={ScrollText}
          title="Loading sessions"
          description="Fetching sessions from the API…"
        />
      ) : error ? (
        <EmptyState
          icon={ScrollText}
          title="Failed to load sessions"
          description={error}
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No sessions in scope"
          description="Loosen filters or import a new dataset to see sessions here."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={sessions}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/sessions/${s.id}`)}
          pageSize={20}
          emptyLabel="No sessions match the search."
          initialSort={{ key: "started_at", dir: "desc" }}
        />
      )}
    </div>
  );
}
