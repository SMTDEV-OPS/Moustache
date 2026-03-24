import * as React from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Skeleton for a stats/KPI card */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardContent className="p-6">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-9 w-16 mb-4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  )
}

/** Grid of KPI card skeletons (e.g. for Dashboard) */
export function DashboardCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Skeleton for a table row (used in DataTable loading state) */
export function TableRowSkeleton({
  columns,
  className,
}: {
  columns: number
  className?: string
}) {
  return (
    <tr className={cn("border-b", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full max-w-[200px]" />
        </td>
      ))}
    </tr>
  )
}

/** Full table skeleton (alternative to DataTable built-in, for custom tables) */
export function TableSkeleton({
  rows = 8,
  columns = 5,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-4 text-left">
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Skeleton for a list item card (e.g. leads, contacts) */
export function ListCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

/** Grid of list card skeletons */
export function ListCardsSkeleton({
  count = 6,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ListCardSkeleton key={i} />
      ))}
    </div>
  )
}
