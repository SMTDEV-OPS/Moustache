import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
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
          <h1 className="font-display text-[22px] font-semibold text-text">
            {title}
          </h1>
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
