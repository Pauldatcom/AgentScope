import { AlertTriangle, CheckCircle2, Clock, XCircle, Loader, PauseCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SessionStatus, DataQuality } from "@/types";

const STATUS = {
  completed: {
    label: "Completed",
    cls: "text-success bg-success/10 border-success/30",
    Icon: CheckCircle2,
  },
  completed_with_errors: {
    label: "Completed (w/ errors)",
    cls: "text-warning bg-warning/10 border-warning/30",
    Icon: AlertTriangle,
  },
  error: {
    label: "Error",
    cls: "text-destructive bg-destructive/10 border-destructive/30",
    Icon: XCircle,
  },
  aborted: {
    label: "Aborted",
    cls: "text-muted-foreground bg-muted/40 border-border",
    Icon: PauseCircle,
  },
  running: {
    label: "Running",
    cls: "text-info bg-info/10 border-info/30",
    Icon: Loader,
  },
} as const;

export function StatusBadge({
  status,
  className,
}: {
  status: SessionStatus;
  className?: string;
}) {
  const cfg = STATUS[status];
  const Icon = cfg.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        cfg.cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

const QUALITY = {
  complete: {
    label: "Complete",
    cls: "text-success bg-success/10 border-success/30",
  },
  partial: {
    label: "Partial",
    cls: "text-warning bg-warning/10 border-warning/30",
  },
  incomplete: {
    label: "Incomplete",
    cls: "text-destructive bg-destructive/10 border-destructive/30",
  },
} as const;

export function QualityBadge({
  quality,
  missingFields,
  className,
}: {
  quality: DataQuality;
  missingFields?: string[];
  className?: string;
}) {
  const cfg = QUALITY[quality];
  const label =
    missingFields && missingFields.length > 0
      ? `${cfg.label} · ${missingFields.length} missing`
      : cfg.label;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        cfg.cls,
        className,
      )}
      title={missingFields ? `Missing: ${missingFields.join(", ")}` : undefined}
    >
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}
