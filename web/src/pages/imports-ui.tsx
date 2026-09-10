import * as React from "react";
import { Bot, MessageSquare } from "lucide-react";

import { cn, formatNumber } from "@/lib/utils";

export function Message({
  role,
  children,
}: {
  role: "agent" | "user";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg p-3 text-xs",
        role === "agent" ? "bg-muted/30" : "bg-transparent",
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          role === "agent"
            ? "bg-primary/15 text-primary"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {role === "agent" ? (
          <Bot className="h-3.5 w-3.5" />
        ) : (
          <MessageSquare className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="flex-1 space-y-1.5 text-foreground/90">{children}</div>
    </div>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const tone =
    value >= 0.8
      ? "bg-success"
      : value >= 0.5
        ? "bg-warning"
        : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", tone)}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {value > 0 ? `${Math.round(value * 100)}%` : "—"}
      </span>
    </div>
  );
}

export function Stat({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
        {value === null || value === undefined ? "—" : formatNumber(value)}
      </div>
    </div>
  );
}
