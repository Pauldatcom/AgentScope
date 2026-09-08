import { useNavigate } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/filter-chip";
import { PERIODS } from "@/types";
import type { Filters } from "@/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";

interface FiltersBarProps {
  filters: Filters;
  onChange: (next: Filters) => void;
  className?: string;
}

const ALL = "all";

const STATUSES: { id: Filters["status"]; label: string }[] = [
  { id: "completed", label: "completed" },
  { id: "completed_with_errors", label: "completed_with_errors" },
  { id: "error", label: "error" },
  { id: "aborted", label: "aborted" },
  { id: "running", label: "running" },
];

export function FiltersBar({ filters, onChange, className }: FiltersBarProps) {
  const navigate = useNavigate();

  const { data: sources } = useApi(() => api.fetchSources(), []);
  const { data: agents } = useApi(() => api.fetchAgents({}), []);
  const { data: models } = useApi(() => api.fetchModels({}), []);

  const sourceList = sources ?? [];
  const agentNames = agents?.map((a) => a.name) ?? [];
  const modelNames = models?.map((m) => m.name) ?? [];

  const activeChips: { label: string; value: string; clear: () => void }[] = [];
  if (filters.sourceId !== "all") {
    const src = sourceList.find((s) => s.id === filters.sourceId);
    activeChips.push({
      label: "Source",
      value: src?.name ?? filters.sourceId,
      clear: () => onChange({ ...filters, sourceId: "all" }),
    });
  }
  if (filters.agent !== "all") {
    activeChips.push({
      label: "Agent",
      value: filters.agent,
      clear: () => onChange({ ...filters, agent: "all" }),
    });
  }
  if (filters.model !== "all") {
    activeChips.push({
      label: "Model",
      value: filters.model,
      clear: () => onChange({ ...filters, model: "all" }),
    });
  }
  if (filters.status !== "all") {
    activeChips.push({
      label: "Status",
      value: filters.status,
      clear: () => onChange({ ...filters, status: "all" }),
    });
  }
  if (filters.period !== "all") {
    activeChips.push({
      label: "Period",
      value: PERIODS.find((p) => p.id === filters.period)?.label ?? "",
      clear: () => onChange({ ...filters, period: "all" }),
    });
  }

  const reset = () =>
    onChange({
      sourceId: "all",
      agent: "all",
      model: "all",
      status: "all",
      period: "7d",
    });

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-card/40 p-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </span>
        <Select
          value={filters.sourceId}
          onValueChange={(v) => onChange({ ...filters, sourceId: v })}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {sourceList.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.agent}
          onValueChange={(v) => onChange({ ...filters, agent: v })}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All agents</SelectItem>
            {agentNames.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.model}
          onValueChange={(v) => onChange({ ...filters, model: v })}
        >
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All models</SelectItem>
            {modelNames.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(v) =>
            onChange({ ...filters, status: v as Filters["status"] })
          }
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.period}
          onValueChange={(v) =>
            onChange({ ...filters, period: v as Filters["period"] })
          }
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeChips.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="ml-auto h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Active:</span>
          {activeChips.map((chip, i) => (
            <FilterChip
              key={i}
              label={chip.label}
              value={chip.value}
              onRemove={chip.clear}
            />
          ))}
          <button
            type="button"
            onClick={() =>
              navigate(
                `/sessions?source=${filters.sourceId}&agent=${filters.agent}&model=${filters.model}&status=${filters.status}&period=${filters.period}`,
              )
            }
            className="ml-1 text-[11px] text-primary hover:underline"
          >
            View filtered sessions →
          </button>
        </div>
      )}
    </div>
  );
}
