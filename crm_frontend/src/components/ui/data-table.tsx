import * as React from "react"
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

export type SortDirection = "asc" | "desc"

export interface DataTableColumn<T> {
  id: string
  header: string
  /** Key to sort by. If not set, column is not sortable. */
  sortKey?: string
  /** Custom cell render. Receives row data. */
  render: (row: T) => React.ReactNode
  className?: string
  /** Make column sticky on mobile (e.g. first column) */
  sticky?: boolean
}

export interface DataTablePagination {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

export interface DataTableSort {
  column: string | null
  direction: SortDirection
  onSort: (column: string | null, direction: SortDirection) => void
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  /** Unique id for each row - used for selection */
  getRowId: (row: T) => string
  /** Show loading skeleton instead of data */
  isLoading?: boolean
  /** Shown when data is empty and not loading */
  emptyState?: React.ReactNode
  pagination?: DataTablePagination
  sort?: DataTableSort
  /** Enable bulk row selection */
  selectable?: boolean
  /** Currently selected row ids */
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  /** Right-aligned row actions (e.g. View, Edit buttons) */
  rowActions?: (row: T) => React.ReactNode
  /** Shown when rows are selected (bulk actions bar) */
  bulkActionsBar?: React.ReactNode
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void
  /** Custom className per row for conditional styling */
  rowClassName?: (row: T) => string | undefined
  className?: string
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading = false,
  emptyState,
  pagination,
  sort,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  rowActions,
  bulkActionsBar,
  onRowClick,
  rowClassName,
  className,
}: DataTableProps<T>) {
  const allIds = React.useMemo(
    () => new Set(data.map((r) => getRowId(r))),
    [data, getRowId]
  )
  const allSelected =
    data.length > 0 && data.every((r) => selectedIds.has(getRowId(r)))
  const someSelected = selectedIds.size > 0

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return
    if (checked) {
      onSelectionChange(new Set(allIds))
    } else {
      onSelectionChange(new Set())
    }
  }

  const handleSelectRow = (id: string, checked: boolean) => {
    if (!onSelectionChange) return
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    onSelectionChange(next)
  }

  const totalPages =
    pagination && pagination.total > 0
      ? Math.ceil(pagination.total / pagination.pageSize)
      : 1

  if (isLoading) {
    const skeletonRows = 8
    return (
      <div className={cn("space-y-4", className)}>
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-12">
                    <Skeleton className="h-4 w-4" />
                  </TableHead>
                )}
                {columns.map((col) => (
                  <TableHead
                    key={col.id}
                    className={col.sticky ? "sticky left-0 bg-background z-10" : ""}
                  >
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                ))}
                {rowActions && (
                  <TableHead className="w-24 text-right">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i}>
                  {selectable && (
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full max-w-[200px]" />
                    </TableCell>
                  ))}
                  {rowActions && <TableCell />}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (data.length === 0 && emptyState) {
    return <div className={cn(className)}>{emptyState}</div>
  }

  return (
    <div className={cn("space-y-4", className)}>
      {someSelected && bulkActionsBar && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} selected
          </span>
          {bulkActionsBar}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    col.sticky && "sticky left-0 bg-muted/50 z-10",
                    col.className
                  )}
                >
                  {sort && col.sortKey ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => {
                        const nextDir: SortDirection =
                          sort.column === col.sortKey && sort.direction === "asc"
                            ? "desc"
                            : "asc"
                        sort.onSort(col.sortKey!, nextDir)
                      }}
                    >
                      {col.header}
                      {sort.column === col.sortKey ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )
                      ) : (
                        <span className="h-4 w-4 opacity-30" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
              {rowActions && (
                <TableHead className="w-24 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const id = getRowId(row)
              return (
                <TableRow
                  key={id}
                  data-state={selectedIds.has(id) ? "selected" : undefined}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    rowClassName?.(row)
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(id)}
                        onCheckedChange={(c) =>
                          handleSelectRow(id, c === true)
                        }
                        aria-label={`Select row ${id}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn(
                        col.sticky && "sticky left-0 bg-background z-10",
                        col.className
                      )}
                    >
                      {col.render(row)}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell className="text-right">
                      {rowActions(row)}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {pagination.onPageSizeChange && (
              <>
                <span>Rows per page</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      {pagination.pageSize}
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <DropdownMenuItem
                        key={size}
                        onClick={() => pagination.onPageSizeChange?.(size)}
                      >
                        {size}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <span>
              {(pagination.page - 1) * pagination.pageSize + 1}-
              {Math.min(
                pagination.page * pagination.pageSize,
                pagination.total
              )}{" "}
              of {pagination.total}
            </span>
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (pagination.page > 1) {
                      pagination.onPageChange(pagination.page - 1)
                    }
                  }}
                  aria-disabled={pagination.page <= 1}
                  className={
                    pagination.page <= 1
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (pagination.page <= 3) {
                  pageNum = i + 1
                } else if (pagination.page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = pagination.page - 2 + i
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        pagination.onPageChange(pageNum)
                      }}
                      isActive={pagination.page === pageNum}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (pagination.page < totalPages) {
                      pagination.onPageChange(pagination.page + 1)
                    }
                  }}
                  aria-disabled={pagination.page >= totalPages}
                  className={
                    pagination.page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
