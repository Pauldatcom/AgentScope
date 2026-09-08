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
  days: number;
}[] = [
  { id: "24h", label: "Last 24 hours", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "all", label: "All time", days: 90 },
];

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
