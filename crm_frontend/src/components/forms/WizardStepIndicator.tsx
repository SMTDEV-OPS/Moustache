import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  num: number;
  label: string;
}

interface WizardStepIndicatorProps {
  steps: readonly WizardStep[];
  currentStep: number;
}

export function WizardStepIndicator({ steps, currentStep }: WizardStepIndicatorProps) {
  return (
    <nav aria-label="Wizard progress" className="flex items-center justify-between gap-1">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;

        return (
          <div key={step.num} className="flex flex-1 items-center min-w-0">
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                  isCompleted && "bg-primary text-white",
                  isActive && "bg-primary text-white ring-2 ring-primary/20",
                  !isCompleted && !isActive && "border border-border bg-surface text-text-muted"
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.num}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium truncate w-full text-center hidden sm:block",
                  isActive ? "text-text" : "text-text-muted"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn("h-px flex-1 mx-0.5 mb-4", isCompleted ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
