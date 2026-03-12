import * as React from "react";
import { cn } from "@/lib/utils";

const BADGE_VARIANTS = {
  heat_hot: { bg: "var(--hot-bg)", text: "var(--hot-text)" },
  heat_warm: { bg: "var(--warm-bg)", text: "var(--warm-text)" },
  heat_cold: { bg: "var(--cold-bg)", text: "var(--cold-text)" },
  src_ivr: { bg: "var(--src-ivr-bg)", text: "var(--src-ivr-text)" },
  src_whatsapp: { bg: "var(--src-wa-bg)", text: "var(--src-wa-text)" },
  src_website: { bg: "var(--src-web-bg)", text: "var(--src-web-text)" },
  src_call: { bg: "var(--src-call-bg)", text: "var(--src-call-text)" },
  src_email: { bg: "var(--src-email-bg)", text: "var(--src-email-text)" },
  stage_new: { bg: "#ede9fe", text: "#7c3aed" },
  stage_active: { bg: "#d1fae5", text: "#065f46" },
  stage_terminal: { bg: "#f1f5f9", text: "#94a3b8" },
  default: { bg: "var(--border-light)", text: "var(--text-muted)" },
} as const;

export type BadgeVariant = keyof typeof BADGE_VARIANTS;

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ label, variant = "default", className }, ref) => {
    const { bg, text } = BADGE_VARIANTS[variant] ?? BADGE_VARIANTS.default;
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.04em]",
          className
        )}
        style={{
          backgroundColor: bg,
          color: text,
          padding: "3px 8px",
          borderRadius: "var(--radius-sm)",
        }}
      >
        {label}
      </span>
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
