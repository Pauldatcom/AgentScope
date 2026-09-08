import * as React from "react";
import { Maximize2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface ChartCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  badge?: string;
  onExpand?: () => void;
}

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  badge,
  onExpand,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border/80 bg-card/60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {title}
            </h3>
            {badge && <Badge variant="outline">{badge}</Badge>}
          </div>
          {description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </div>
  );
}
