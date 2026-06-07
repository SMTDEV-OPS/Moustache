import { ReactNode } from "react";
import { PageHelp } from "@/components/help/PageHelp";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  helpArticleId?: string;
  helpRelatedView?: string;
  helpSummary?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  helpArticleId,
  helpRelatedView,
  helpSummary,
}: PageHeaderProps) {
  const showHelp = helpArticleId || helpRelatedView || helpSummary;
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        className="flex justify-between items-start"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-text font-semibold"
              style={{ fontSize: 22, fontWeight: 600, color: "var(--text)" }}
            >
              {title}
            </h1>
            {showHelp && (
              <PageHelp
                title={title}
                articleId={helpArticleId}
                relatedView={helpRelatedView}
                summary={helpSummary}
              />
            )}
          </div>
          {subtitle && (
            <p
              className="text-text-muted"
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div
            className="flex gap-2 items-center"
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
