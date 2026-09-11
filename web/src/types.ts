/** Shared UI types — independent of mock or API.
 *
 * Used by components (StatusBadge, FiltersBar, etc.) and pages.
 * The mock layer and the API client both produce data that conforms to these.
 */

export type SessionStatus =
  | "completed"
  | "completed_with_errors"
  | "error"
  | "aborted"
  | "running";

export type DataQuality = "complete" | "partial" | "incomplete";

export interface Filters {
  sourceId: string | "all";
  agent: string | "all";
  model: string | "all";
  status: SessionStatus | "all";
  period: "24h" | "7d" | "30d" | "all";
}

export const PERIODS: {
  id: Filters["period"];
  label: string;
  days: number | null;
}[] = [
  { id: "24h", label: "Last 24 hours", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "all", label: "All time", days: null },
];

export const DEFAULT_FILTERS: Filters = {
  sourceId: "all",
  agent: "all",
  model: "all",
  status: "all",
  period: "all",
};

export function periodCutoffMs(period: Filters["period"]): number | null {
  const days = PERIODS.find((p) => p.id === period)?.days ?? null;
  if (days === null) return null;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export function isInPeriod(
  iso: string | null | undefined,
  period: Filters["period"],
): boolean {
  const cutoff = periodCutoffMs(period);
  if (cutoff === null) return true;
  if (!iso) return false;
  const ts = Date.parse(iso);
  return !Number.isNaN(ts) && ts >= cutoff;
}

export interface TimelineEvent {
  id: string;
  type:
    | "prompt"
    | "response"
    | "tool_call"
    | "tool_result"
    | "error"
    | "retry"
    | "cache_hit"
    | "cache_miss"
    | "final";
  ts: string;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheTokens: number | null;
  toolName: string | null;
  roundIndex: number | null;
  isError: boolean;
  title: string;
  detail: string;
  io?: { input?: string; output?: string };
}
