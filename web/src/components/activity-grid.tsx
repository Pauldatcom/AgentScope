import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ActivityCellData {
  date: string;
  label: string;
  sessions: number;
  tokens: number;
  toolCalls: number;
  errors: number;
}

export interface ActivityGridProps {
  cells: ActivityCellData[];
  /** days back from today to show (columns) */
  days?: number;
  /** metric to color by */
  metric?: "sessions" | "tokens" | "toolCalls" | "errors";
  onCellClick?: (cell: ActivityCellData) => void;
}

function colorScale(v: number, max: number, metric: string): string {
  if (v <= 0) return "bg-muted/30 border-border/40";
  const r = Math.min(v / max, 1);
  if (metric === "errors") {
    if (r < 0.25) return "bg-warning/30 border-warning/40";
    if (r < 0.5) return "bg-warning/60 border-warning/50";
    if (r < 0.75) return "bg-destructive/60 border-destructive/50";
    return "bg-destructive/80 border-destructive/60";
  }
  if (r < 0.2) return "bg-primary/20 border-primary/30";
  if (r < 0.4) return "bg-primary/40 border-primary/40";
  if (r < 0.6) return "bg-primary/60 border-primary/50";
  if (r < 0.8) return "bg-primary/80 border-primary/60";
  return "bg-primary border-primary/70";
}

export function ActivityGrid({
  cells,
  metric = "sessions",
  onCellClick,
}: ActivityGridProps) {
  const max = Math.max(...cells.map((c) => c[metric]), 1);
  // Group cells by day (35 columns), each column has 24 hours.
  const byDay = new Map<string, ActivityCellData[]>();
  for (const c of cells) {
    if (!byDay.has(c.date)) byDay.set(c.date, []);
    byDay.get(c.date)!.push(c);
  }
  const days = Array.from(byDay.keys()).sort();

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-2">
        <div className="flex gap-0.5 overflow-x-auto pb-1">
          {days.map((day) => {
            const hours = byDay.get(day)!;
            return (
              <div key={day} className="flex flex-col gap-0.5">
                {hours.map((cell, hourIdx) => {
                  const v = cell[metric];
                  return (
                    <Tooltip key={`${day}-${hourIdx}`}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onCellClick?.(cell)}
                          className={cn(
                            "h-3.5 w-3.5 rounded-[3px] border transition-all hover:ring-2 hover:ring-ring/40",
                            colorScale(v, max, metric),
                            onCellClick && "cursor-pointer",
                          )}
                          aria-label={`${cell.label}: ${v} ${metric}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {cell.label}
                          </span>
                          <span className="text-muted-foreground">
                            {v} {metric}
                          </span>
                          <span className="text-muted-foreground/80">
                            {cell.tokens.toLocaleString()} tokens ·{" "}
                            {cell.toolCalls} tool calls · {cell.errors} errors
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="flex items-center gap-0.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-muted/30 border border-border/40" />
            <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/40 border border-primary/40" />
            <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/60 border border-primary/50" />
            <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/80 border border-primary/60" />
            <span className="h-2.5 w-2.5 rounded-[3px] bg-primary border border-primary/70" />
          </div>
          <span>More</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
