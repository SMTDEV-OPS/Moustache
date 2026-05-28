import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  variant?: "dashboard" | "table" | "detail";
}

export function PageSkeleton({ variant = "table" }: PageSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <div className="space-y-6 animate-panel-enter">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="grid gap-6 lg:grid-cols-[280px_1fr_300px] animate-panel-enter">
        <Skeleton className="h-96 rounded-md" />
        <Skeleton className="h-96 rounded-md" />
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-panel-enter">
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 max-w-md" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
