import { AlertTriangle, Info, XCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "error" | "success";

const TONES: Record<Tone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-info/30 bg-info/10 text-info", Icon: Info },
  warning: {
    cls: "border-warning/30 bg-warning/10 text-warning",
    Icon: AlertTriangle,
  },
  error: {
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
    Icon: XCircle,
  },
  success: {
    cls: "border-success/30 bg-success/10 text-success",
    Icon: CheckCircle2,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const cfg = TONES[tone];
  const Icon = cfg.Icon;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs",
        cfg.cls,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 space-y-0.5">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className="text-foreground/80">{children}</div>}
      </div>
    </div>
  );
}
