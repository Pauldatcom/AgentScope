import * as React from "react";
import { Info, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Change vs. previous period. `null` means "no comparable previous period". */
  delta?: {
    pct: number | null;
    sign: "up" | "down" | "flat";
    good: boolean;
  };
  scope: string;
  definition?: string;
  /** When true the metric is not comparable across sources. */
  notComparable?: boolean;
  warning?: string;
  className?: string;
}

function DeltaBadge({
  delta,
}: {
  delta: NonNullable<KpiCardProps["delta"]>;
}) {
  const Icon =
    delta.sign === "up"
      ? ArrowUpRight
      : delta.sign === "down"
        ? ArrowDownRight
        : Minus;
  const tone = delta.good ? "text-success" : "text-destructive";
  const neutral = delta.sign === "flat" || delta.pct === null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium",
        neutral ? "text-muted-foreground" : tone,
      )}
    >
      <Icon className="h-3 w-3" />
      {delta.pct === null ? "N/A" : `${Math.abs(delta.pct).toFixed(1)}%`}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  scope,
  definition,
  notComparable,
  warning,
  className,
}: KpiCardProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "group relative flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 transition-colors hover:border-border",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            {definition && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground/60 transition-colors hover:text-foreground"
                    aria-label={`Definition of ${label}`}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px]">
                  <div className="space-y-1.5">
                    <div className="font-medium text-foreground">{label}</div>
                    <div className="text-muted-foreground">{definition}</div>
                    <div className="text-muted-foreground/80">
                      <span className="text-foreground/80">Scope:</span> {scope}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {notComparable && (
            <Badge variant="warning" className="shrink-0 text-[10px]">
              not comparable
            </Badge>
          )}
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </span>
          {unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {delta ? (
            <DeltaBadge delta={delta} />
          ) : (
            <span className="text-[11px] text-muted-foreground/60">—</span>
          )}
          <span className="text-[10px] text-muted-foreground/70">
            {scope}
          </span>
        </div>

        {warning && (
          <div className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] text-warning">
            {warning}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
    </div>
  );
}
