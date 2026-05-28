import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
}

export function StickyActionBar({ children, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-border bg-surface/95 px-6 py-4 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
