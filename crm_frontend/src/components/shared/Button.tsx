import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  children?: React.ReactNode;
  loading?: boolean;
}

const getVariantStyles = (variant: ButtonVariant): React.CSSProperties => {
  switch (variant) {
    case "primary":
      return { backgroundColor: "var(--primary)", color: "white", border: "none" };
    case "secondary":
      return {
        backgroundColor: "var(--surface)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      };
    case "ghost":
      return {
        backgroundColor: "transparent",
        color: "var(--text-muted)",
        border: "none",
      };
    case "danger":
      return {
        backgroundColor: "#fef2f2",
        color: "#ef4444",
        border: "1px solid #fecaca",
      };
    default:
      return { backgroundColor: "var(--primary)", color: "white", border: "none" };
  }
};

const getSizeStyles = (size: ButtonSize): React.CSSProperties => {
  switch (size) {
    case "sm":
      return {
        height: "28px",
        padding: "0 10px",
        fontSize: "13px",
        borderRadius: "var(--radius)",
      };
    case "md":
    default:
      return {
        height: "34px",
        padding: "0 14px",
        fontSize: "14px",
        borderRadius: "var(--radius-md)",
      };
  }
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon: Icon,
      children,
      onClick,
      disabled,
      loading = false,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const baseStyle: React.CSSProperties = {
      ...getVariantStyles(variant),
      ...getSizeStyles(size),
      transition: "background 120ms ease",
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        onClick={onClick}
        className={cn("btn-shared inline-flex items-center justify-center gap-2 font-medium", isDisabled && "opacity-50 cursor-not-allowed", className)}
        data-variant={variant}
        style={{ ...baseStyle, ...style }}
        {...props}
      >
        {loading ? (
          <span
            className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden
          />
        ) : Icon ? (
          <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
        ) : null}
        {!loading && children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
