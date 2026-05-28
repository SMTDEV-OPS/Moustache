import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface FormWizardShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  stepIndicator?: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  maxHeight?: string;
}

const maxWidthClass: Record<NonNullable<FormWizardShellProps["maxWidth"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

export function FormWizardShell({
  open,
  onOpenChange,
  title,
  subtitle,
  stepIndicator,
  children,
  footer,
  maxWidth = "2xl",
  maxHeight = "min(90vh,720px)",
}: FormWizardShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          maxWidthClass[maxWidth],
          "flex flex-col gap-0 p-0 overflow-hidden",
          maxWidth === "3xl" && "sm:max-w-3xl",
          maxWidth === "4xl" && "sm:max-w-4xl",
          maxHeight === "min(90vh,720px)" && "h-[min(90vh,720px)]",
          maxHeight === "min(90vh,800px)" && "h-[min(90vh,800px)]",
          maxHeight === "min(90vh,860px)" && "h-[min(90vh,860px)]"
        )}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          {subtitle && <DialogDescription className="text-sm">{subtitle}</DialogDescription>}
          {stepIndicator && <div className="pt-3">{stepIndicator}</div>}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">{children}</div>

        <div className="shrink-0 flex justify-between gap-2 px-6 py-4 border-t border-border bg-surface">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
