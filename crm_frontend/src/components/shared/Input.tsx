import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type InputSize = "sm" | "md";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  placeholder?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  icon?: LucideIcon;
  size?: InputSize;
  disabled?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      placeholder,
      value,
      onChange,
      icon: Icon,
      size = "md",
      disabled,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const height = size === "sm" ? "28px" : "34px";
    const fontSize = size === "sm" ? "13px" : "14px";
    const hasIcon = !!Icon;

    return (
      <div className={cn("relative inline-flex w-full", className)}>
        {Icon && (
          <Icon
            className="absolute left-[10px] top-1/2 -translate-y-1/2 w-4 h-4 shrink-0 pointer-events-none"
            style={{ color: "var(--text-faint)" }}
            strokeWidth={1.5}
          />
        )}
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "w-full border rounded-[var(--radius)]",
            "focus:outline-none focus:border-[var(--primary)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "bg-[var(--surface)]"
          )}
          style={{
            height,
            paddingLeft: hasIcon ? "34px" : "12px",
            paddingRight: "12px",
            fontSize,
            color: "var(--text)",
            border: "1px solid var(--border)",
            fontFamily: "var(--font)",
            ...style,
          }}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
