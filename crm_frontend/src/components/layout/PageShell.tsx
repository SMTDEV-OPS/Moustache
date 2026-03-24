import * as React from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

export type PageBreadcrumbItem = {
  label: string
  href?: string
  onClick?: () => void
}

interface PageShellProps {
  children: React.ReactNode
  className?: string
  /** Breadcrumb items. Last item is current page (not clickable). */
  breadcrumbs?: PageBreadcrumbItem[]
  /** Optional overline label (e.g. "DASHBOARD", "LEADS") - uses tracking-widest caps */
  overline?: string
  /** Main page title */
  title?: string
  /** Optional description below title */
  description?: string
  /** Right-aligned action buttons */
  actions?: React.ReactNode
}

const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  (
    {
      children,
      className,
      breadcrumbs,
      overline,
      title,
      description,
      actions,
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-6", className)}
    >
      {(breadcrumbs?.length ?? 0) > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs!.map((item, i) => {
              const isLast = i === breadcrumbs!.length - 1
              return (
                <React.Fragment key={i}>
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    ) : item.href ? (
                      <BreadcrumbLink href={item.href}>
                        {item.label}
                      </BreadcrumbLink>
                    ) : item.onClick ? (
                      <button
                        type="button"
                        onClick={item.onClick}
                        className="transition-colors hover:text-foreground"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {(overline ?? title ?? description ?? actions) && (
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            {overline && (
              <p className="text-xs font-medium text-muted-foreground">
                {overline}
              </p>
            )}
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
              {actions}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  )
)
PageShell.displayName = "PageShell"

export { PageShell }
