import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { num: 1, label: "Guest" },
  { num: 2, label: "Stay" },
  { num: 3, label: "Booking" },
  { num: 4, label: "Review" },
] as const;

interface AddLeadStepIndicatorProps {
  currentStep: number;
}

export function AddLeadStepIndicator({ currentStep }: AddLeadStepIndicatorProps) {
  return (
    <nav aria-label="Add lead progress" className="flex items-center justify-between gap-2">
      {STEPS.map((step, index) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;
        const isUpcoming = currentStep < step.num;

        return (
          <div key={step.num} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isCompleted && "bg-primary text-white",
                  isActive && "bg-primary text-white ring-2 ring-primary/20",
                  isUpcoming && "border border-border bg-surface text-text-muted"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.num}
              </div>
              <span
                className={cn(
                  "text-xs font-medium truncate w-full text-center",
                  isActive ? "text-text" : "text-text-muted"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-1 mb-5",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export const ADD_LEAD_STEP_SUBTITLES: Record<number, string> = {
  1: "Who is the guest?",
  2: "Where and when are they staying?",
  3: "How did this inquiry come in?",
  4: "Confirm details before creating the lead",
};
