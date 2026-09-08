import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Hash,
  Zap,
  AlertOctagon,
  RotateCcw,
  Database,
  CheckCircle2,
  MessageSquare,
  Terminal,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { KpiCard, KpiCardSkeleton } from "@/components/kpi-card";
import { StatusBadge, QualityBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  api,
  type SessionDetail as ApiSessionDetail,
  type ModelCallOut,
  type ToolCallOut,
} from "@/api";
import { useApi } from "@/hooks/useApi";
import type { TimelineEvent, SessionStatus, DataQuality } from "@/types";
import {
  formatDuration,
  formatMs,
  formatTokens,
  formatTime,
  cn,
} from "@/lib/utils";

const EVENT_STYLE: Record<
  TimelineEvent["type"],
  { icon: typeof Hash; color: string; ring: string; label: string }
> = {
  prompt: {
    icon: MessageSquare,
    color: "text-chart-1",
    ring: "ring-chart-1/30 bg-chart-1/10",
    label: "Prompt",
  },
  response: {
    icon: MessageSquare,
    color: "text-chart-3",
    ring: "ring-chart-3/30 bg-chart-3/10",
    label: "Response",
  },
  tool_call: {
    icon: Terminal,
    color: "text-chart-2",
    ring: "ring-chart-2/30 bg-chart-2/10",
    label: "Tool call",
  },
  tool_result: {
    icon: Terminal,
    color: "text-chart-2",
    ring: "ring-chart-2/30 bg-chart-2/10",
    label: "Tool result",
  },
  error: {
    icon: AlertOctagon,
    color: "text-destructive",
    ring: "ring-destructive/40 bg-destructive/10",
    label: "Error",
  },
  retry: {
    icon: RotateCcw,
    color: "text-warning",
    ring: "ring-warning/30 bg-warning/10",
    label: "Retry",
  },
  cache_hit: {
    icon: Database,
    color: "text-chart-5",
    ring: "ring-chart-5/30 bg-chart-5/10",
    label: "Cache hit",
  },
  cache_miss: {
    icon: Database,
    color: "text-muted-foreground",
    ring: "ring-border bg-muted/40",
    label: "Cache miss",
  },
  final: {
    icon: CheckCircle2,
    color: "text-success",
    ring: "ring-success/30 bg-success/10",
    label: "Final",
  },
};

function buildTimeline(
  modelCalls: ModelCallOut[],
  toolCalls: ToolCallOut[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const call of modelCalls) {
    const ts = call.occurred_at ?? new Date().toISOString();
    events.push({
      id: `${call.id}-prompt`,
      type: "prompt",
      ts,
      durationMs: call.latency_ms,
      promptTokens: call.prompt_tokens,
      completionTokens: null,
      cacheTokens: null,
      toolName: null,
      roundIndex: call.round_index,
      isError: false,
      title: `Round ${call.round_index} — user prompt`,
      detail: "",
    });
    events.push({
      id: `${call.id}-response`,
      type:
        call.cache_creation_tokens !== null && call.cache_creation_tokens > 0
          ? "cache_hit"
          : "response",
      ts,
      durationMs: call.latency_ms,
      promptTokens: null,
      completionTokens: call.completion_tokens,
      cacheTokens: call.cache_creation_tokens,
      toolName: null,
      roundIndex: call.round_index,
      isError: call.is_error,
      title: call.is_error ? "Model call error" : "Model response",
      detail: "",
    });
  }

  for (const t of toolCalls) {
    events.push({
      id: `${t.id}-tool`,
      type: "tool_call",
      ts: t.occurred_at ?? new Date().toISOString(),
      durationMs: t.wall_latency_ms,
      promptTokens: null,
      completionTokens: null,
      cacheTokens: null,
      toolName: t.tool_name,
      roundIndex: null,
      isError: t.is_error,
      title: t.is_error
        ? `Tool call failed: ${t.tool_name}`
        : `Tool call: ${t.tool_name}`,
      detail: "",
      io: {
        input: t.input_chars ? `${t.input_chars} chars` : undefined,
        output: t.result_chars ? `${t.result_chars} chars` : undefined,
      },
    });
  }

  events.sort((a, b) => {
    const ra = a.roundIndex ?? Number.POSITIVE_INFINITY;
    const rb = b.roundIndex ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return a.ts.localeCompare(b.ts);
  });

  const lastTs = events.length > 0 ? events[events.length - 1].ts : null;
  const finalTs =
    lastTs !== null && !Number.isNaN(Date.parse(lastTs))
      ? new Date(Date.parse(lastTs) + 1000).toISOString()
      : new Date().toISOString();

  events.push({
    id: "final",
    type: "final",
    ts: finalTs,
    durationMs: null,
    promptTokens: null,
    completionTokens: null,
    cacheTokens: null,
    toolName: null,
    roundIndex: null,
    isError: false,
    title: "Session complete",
    detail: "Reached a natural end.",
  });

  return events;
}

function EventRow({ event }: { event: TimelineEvent }) {
  const cfg = EVENT_STYLE[event.type];
  const Icon = cfg.icon;
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="relative flex gap-3">
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full ring-2",
            cfg.ring,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
        </div>
        {event.type !== "final" && (
          <div className="absolute top-7 h-full w-px bg-border/60" />
        )}
      </div>
      <div className="flex-1 pb-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-left transition-colors hover:border-border"
        >
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-medium", cfg.color)}>
              {cfg.label}
            </span>
            {event.toolName && (
              <Badge variant="secondary" className="text-[10px]">
                {event.toolName}
              </Badge>
            )}
            {event.isError && (
              <Badge variant="destructive" className="text-[10px]">
                error
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {event.title}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {event.durationMs !== null && (
              <span className="flex items-center gap-1 font-mono tabular-nums">
                <Clock className="h-3 w-3" /> {formatMs(event.durationMs)}
              </span>
            )}
            {(event.promptTokens ?? event.completionTokens ?? event.cacheTokens) !==
              null && (
              <span className="flex items-center gap-1 font-mono tabular-nums">
                <Zap className="h-3 w-3" />{" "}
                {[
                  event.promptTokens && `${event.promptTokens}↑`,
                  event.completionTokens && `${event.completionTokens}↓`,
                  event.cacheTokens && `${event.cacheTokens} cache`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
            <span className="font-mono tabular-nums">
              {formatTime(event.ts)}
            </span>
          </div>
        </button>
        {expanded && (
          <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs animate-slide-up">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Detail
              </div>
              <div className="text-foreground/90">{event.detail}</div>
            </div>
            {event.io && (
              <div className="grid gap-2 sm:grid-cols-2">
                {event.io.input && (
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Input
                    </div>
                    <pre className="overflow-x-auto rounded bg-background/60 p-2 font-mono text-[11px] text-foreground/80">
                      {event.io.input}
                    </pre>
                  </div>
                )}
                {event.io.output && (
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Output
                    </div>
                    <pre className="overflow-x-auto rounded bg-background/60 p-2 font-mono text-[11px] text-foreground/80">
                      {event.io.output}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: detail, loading, error } = useApi<ApiSessionDetail>(
    () => api.fetchSession(id!),
    [id],
  );

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/sessions" className="hover:text-foreground">
            Sessions
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-mono text-foreground">{id}</span>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border/80 bg-card/40 p-4">
              <div className="mb-4 h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 w-full animate-pulse rounded bg-muted/60"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon={Hash}
          title="Session not found"
          description={
            error
              ? error
              : id
                ? `No session with id "${id}".`
                : "No session id provided."
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/sessions")}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to sessions
            </Button>
          }
        />
      </div>
    );
  }

  const session = detail.session as {
    id: string;
    external_session_id: string;
    agent: string | null;
    model: string | null;
    started_at: string | null;
    ended_at: string | null;
    source_id: string;
  };

  const modelCalls = detail.model_calls;
  const toolCalls = detail.tool_calls;

  const promptTokens = modelCalls.reduce(
    (a, c) => a + (c.prompt_tokens ?? 0),
    0,
  );
  const completionTokens = modelCalls.reduce(
    (a, c) => a + (c.completion_tokens ?? 0),
    0,
  );
  const cacheTokens = modelCalls.reduce(
    (a, c) => a + (c.cache_creation_tokens ?? 0),
    0,
  );
  const totalTokens =
    modelCalls.some(
      (c) => c.prompt_tokens != null || c.completion_tokens != null,
    ) || promptTokens + completionTokens > 0
      ? promptTokens + completionTokens
      : null;

  const startedMs =
    session.started_at !== null && !Number.isNaN(Date.parse(session.started_at))
      ? Date.parse(session.started_at)
      : null;
  const endedMs =
    session.ended_at !== null && !Number.isNaN(Date.parse(session.ended_at))
      ? Date.parse(session.ended_at)
      : null;
  const durationMs =
    startedMs !== null && endedMs !== null ? endedMs - startedMs : null;

  const toolCallCount = toolCalls.length;
  const errorCount =
    modelCalls.filter((c) => c.is_error).length +
    toolCalls.filter((t) => t.is_error).length;
  const retries = 0;

  const modelErrors = modelCalls.filter((c) => c.is_error).length;
  const status: SessionStatus =
    modelErrors === 0
      ? "completed"
      : modelErrors > 2
        ? "error"
        : "completed_with_errors";

  const missingFields: string[] = [];
  if (totalTokens === null) missingFields.push("tokens");
  if (durationMs === null) missingFields.push("duration");
  const quality: DataQuality =
    missingFields.length === 0
      ? "complete"
      : missingFields.length <= 2
        ? "partial"
        : "incomplete";

  const events = buildTimeline(modelCalls, toolCalls);

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/sessions" className="hover:text-foreground">
          Sessions
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono text-foreground">{session.id}</span>
      </div>
      <PageHeader
        title={`Session ${session.external_session_id}`}
        description={`${session.agent ?? "unknown agent"} · ${session.model ?? "unknown model"}`}
      >
        <Link to="/sessions">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
          </Button>
        </Link>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        <QualityBadge quality={quality} missingFields={missingFields} />
        {missingFields.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            Missing: {missingFields.join(", ")}
          </span>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Duration"
          value={durationMs !== null ? formatDuration(durationMs) : "N/A"}
          scope="this session"
        />
        <KpiCard
          label="Total tokens"
          value={formatTokens(totalTokens)}
          unit="tokens"
          scope="this session"
        />
        <KpiCard
          label="Tool calls"
          value={String(toolCallCount)}
          unit="calls"
          scope="this session"
        />
        <KpiCard
          label="Errors"
          value={String(errorCount)}
          scope="this session"
        />
        <KpiCard label="Retries" value={String(retries)} scope="this session" />
        <KpiCard
          label="Cache tokens"
          value={cacheTokens > 0 ? formatTokens(cacheTokens) : "N/A"}
          unit="tokens"
          scope="model calls w/ cache"
          notComparable
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/80 bg-card/40 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Session timeline
              </h2>
              <span className="text-xs text-muted-foreground">
                {events.length} events
              </span>
            </div>
            <div className="flex flex-col">
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border/80 bg-card/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Token breakdown
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-chart-1" /> Prompt
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {formatTokens(promptTokens)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-chart-3" /> Completion
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {formatTokens(completionTokens)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-chart-5" /> Cache
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {cacheTokens > 0 ? formatTokens(cacheTokens) : "N/A"}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-card/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Metadata
            </h3>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">External ID</dt>
                <dd className="font-mono text-foreground">
                  {session.external_session_id}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-mono text-foreground">
                  {session.source_id}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Agent</dt>
                <dd className="text-foreground">{session.agent ?? "N/A"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Model</dt>
                <dd className="font-mono text-foreground">
                  {session.model ?? "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Started</dt>
                <dd className="font-mono text-foreground">
                  {formatTime(session.started_at)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ended</dt>
                <dd className="font-mono text-foreground">
                  {formatTime(session.ended_at)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
