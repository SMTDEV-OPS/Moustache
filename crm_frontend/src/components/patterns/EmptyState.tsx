import { LucideIcon } from "lucide-react";
import { Button } from "@/components/shared/Button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-panel-enter">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-border bg-surface">
          <Icon className="h-6 w-6 text-text-muted" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-text-muted">{description}</p>
      )}
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
