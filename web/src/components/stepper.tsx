import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StepperProps {
  steps: { id: string; label: string; description?: string }[];
  current: string;
  completed?: string[];
  onStepClick?: (id: string) => void;
}

export function Stepper({
  steps,
  current,
  completed = [],
  onStepClick,
}: StepperProps) {
  const currentIdx = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {steps.map((step, i) => {
        const done = completed.includes(step.id) || i < currentIdx;
        const active = step.id === current;
        return (
          <li key={step.id} className="flex items-center">
            <button
              type="button"
              disabled={!onStepClick}
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 transition-colors",
                onStepClick && "hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ring-1 transition-colors",
                  active &&
                    "bg-primary text-primary-foreground ring-primary",
                  done &&
                    !active &&
                    "bg-success/20 text-success ring-success/40",
                  !active &&
                    !done &&
                    "bg-muted text-muted-foreground ring-border",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "mx-1 h-3 w-6 rounded-full sm:w-10",
                  i < currentIdx ? "bg-success/40" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
