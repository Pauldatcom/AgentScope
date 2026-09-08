import * as React from "react";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  FileWarning,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { DataTable, type Column } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  api,
  type DataQualityOut,
  type ImportRunOut,
  type RejectionOut,
} from "@/api";
import { useApi } from "@/hooks/useApi";
import {
  formatNumber,
  formatPercent,
  relativeTime,
} from "@/lib/utils";

export function DataQualityPage() {
  const { data, loading, error } = useApi<DataQualityOut>(
    () => api.fetchDataQuality({}),
    [],
  );

  const sourceName = React.useCallback(
    (id: string) => data?.sources?.find((s) => s.id === id)?.name ?? id,
    [data],
  );

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Data quality"
          description="Completeness, rejections, missing fields, and cross-source comparability."
        />
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-border/80 bg-muted/20"
            />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl border border-border/80 bg-muted/20"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Data quality"
          description="Completeness, rejections, missing fields, and cross-source comparability."
        />
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load data quality"
          description={error}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Data quality"
          description="Completeness, rejections, missing fields, and cross-source comparability."
        />
        <EmptyState
          icon={FileWarning}
          title="No data quality report yet"
          description="Import a dataset to see completeness, coverage, and rejections here."
        />
      </div>
    );
  }

  const total = data.total_sessions;
  const tokensCov = total > 0 ? data.with_tokens / total : 0;
  const durationCov = total > 0 ? data.with_duration / total : 0;
  const cacheCov = total > 0 ? data.with_cache / total : 0;
  const errorCov = total > 0 ? data.with_errors / total : 0;

  const importColumns: Column<ImportRunOut>[] = [
    {
      key: "filename",
      header: "File",
      sortable: true,
      render: (i) => (
        <span className="font-mono text-foreground">{i.filename}</span>
      ),
    },
    {
      key: "source_id",
      header: "Source",
      sortable: true,
      render: (i) => (
        <span className="text-foreground">{sourceName(i.source_id)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (i) => (
        <Badge
          variant={
            i.status === "ok"
              ? "success"
              : i.status === "duplicate"
                ? "secondary"
                : i.status === "warning"
                  ? "warning"
                  : i.status === "incomplete"
                    ? "warning"
                    : "destructive"
          }
          className="text-[10px]"
        >
          {i.status}
        </Badge>
      ),
    },
    {
      key: "rows_read",
      header: "Rows",
      sortable: true,
      align: "right",
      render: (i) => (
        <span className="font-mono tabular-nums">
          {formatNumber(i.rows_read)}
        </span>
      ),
    },
    {
      key: "sessions_imported",
      header: "Imported",
      sortable: true,
      align: "right",
      render: (i) => (
        <span className="font-mono tabular-nums">
          {formatNumber(i.sessions_imported)}
        </span>
      ),
    },
    {
      key: "duplicates",
      header: "Duplicates",
      sortable: true,
      align: "right",
      render: (i) => (
        <span
          className={
            i.duplicates > 0
              ? "font-mono tabular-nums text-warning"
              : "font-mono tabular-nums text-muted-foreground"
          }
        >
          {formatNumber(i.duplicates)}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Imported",
      sortable: true,
      align: "right",
      render: (i) => (
        <span className="text-muted-foreground">
          {relativeTime(i.created_at)}
        </span>
      ),
    },
  ];

  const rejectionColumns: Column<RejectionOut>[] = [
    {
      key: "line_number",
      header: "Line",
      sortable: true,
      align: "right",
      render: (r) => (
        <span className="font-mono tabular-nums">{r.line_number}</span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (r) => <span className="text-foreground">{r.reason}</span>,
    },
    {
      key: "import_run_id",
      header: "Import",
      render: (r) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {r.import_run_id}
        </span>
      ),
    },
    {
      key: "excerpt",
      header: "Excerpt",
      render: (r) => (
        <code className="block truncate font-mono text-[11px] text-muted-foreground">
          {r.excerpt}
        </code>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Data quality"
        description="Completeness, rejections, missing fields, and cross-source comparability."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Total sessions"
          value={formatNumber(total)}
          scope="imported sessions in scope"
        />
        <KpiCard
          label="Tokens coverage"
          value={formatPercent(tokensCov)}
          scope={`${formatNumber(data.with_tokens)} / ${formatNumber(total)} sessions`}
        />
        <KpiCard
          label="Cache coverage"
          value={formatPercent(cacheCov)}
          scope={`${formatNumber(data.with_cache)} / ${formatNumber(total)} sessions`}
        />
        <KpiCard
          label="Rejections"
          value={formatNumber(data.rejections.length)}
          unit="rows"
          scope={`${data.imports.length} import runs`}
        />
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <ChartCard
          title="Field coverage"
          description="Share of sessions with non-null values per field."
        >
          <div className="flex flex-col gap-3">
            {[
              {
                label: "Tokens (prompt + completion)",
                value: data.tokens_coverage ?? tokensCov,
                def: "Sessions where both prompt_tokens and completion_tokens are non-null.",
              },
              {
                label: "Duration (start → end)",
                value: data.duration_coverage ?? durationCov,
                def: "Sessions with both started_at and ended_at timestamps.",
              },
              {
                label: "Cache tokens",
                value: data.cache_coverage ?? cacheCov,
                def: "Sessions whose model reports cache tokens — excludes providers without a cache field.",
              },
              {
                label: "Errors",
                value: data.error_coverage ?? errorCov,
                def: "Sessions with at least one failing model call or tool call.",
              },
            ].map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-foreground">{c.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatPercent(c.value)}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                    style={{ width: `${c.value * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {c.def}
                </p>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Comparability"
          description="Sources imported into the warehouse."
        >
          <div className="flex flex-col gap-2">
            {data.sources.map((src) => (
              <div
                key={src.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {src.name}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {src.version} · {src.method}
                    {src.license ? ` · ${src.license}` : ""}
                  </p>
                </div>
              </div>
            ))}
            {data.sources.length === 0 && (
              <EmptyState
                icon={FileWarning}
                title="No sources"
                description="No sources have been imported yet."
              />
            )}
          </div>
        </ChartCard>

        <ChartCard
          title="Quality distribution"
          description="Sessions by field presence."
        >
          <div className="flex h-48 items-end justify-around gap-4 pt-6">
            {[
              {
                label: "With tokens",
                value: data.with_tokens,
                tone: "bg-success",
                Icon: ShieldCheck,
              },
              {
                label: "With duration",
                value: data.with_duration,
                tone: "bg-info",
                Icon: ShieldCheck,
              },
              {
                label: "With cache",
                value: data.with_cache,
                tone: "bg-primary",
                Icon: ShieldCheck,
              },
              {
                label: "With errors",
                value: data.with_errors,
                tone: "bg-destructive",
                Icon: XCircle,
              },
            ].map((b) => {
              const Icon = b.Icon;
              return (
                <div
                  key={b.label}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className={`w-full rounded-t-md ${b.tone}`}
                    style={{
                      height: `${Math.max(
                        total > 0 ? (b.value / total) * 100 : 0,
                        4,
                      )}%`,
                    }}
                  />
                  <span className="font-mono text-xs tabular-nums text-foreground">
                    {formatNumber(b.value)}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    <span>{b.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      <div className="mb-5">
        <ChartCard
          title="Import runs"
          description={`${data.imports.length} runs · click a row to inspect rejections`}
        >
          <DataTable
            columns={importColumns}
            rows={data.imports}
            rowKey={(i) => i.id}
            pageSize={8}
            initialSort={{ key: "created_at", dir: "desc" }}
            emptyLabel="No imports yet."
          />
        </ChartCard>
      </div>

      {data.rejections.length > 0 && (
        <div className="mb-5">
          <ChartCard
            title="Rejections"
            description={`${data.rejections.length} rows were rejected during import.`}
          >
            <Accordion type="single" collapsible>
              <AccordionItem value="rejections" className="border-0">
                <AccordionTrigger className="text-xs">
                  Show {data.rejections.length} rejected rows
                </AccordionTrigger>
                <AccordionContent>
                  <DataTable
                    columns={rejectionColumns}
                    rows={data.rejections.slice(0, 20)}
                    rowKey={(r) => r.id}
                    pageSize={8}
                    emptyLabel="No rejections."
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
