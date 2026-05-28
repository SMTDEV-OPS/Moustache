import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
  placeholder?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      children,
      placeholder,
      value,
      onChange,
      size = "md",
      disabled,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const height = size === "sm" ? "28px" : "34px";

    return (
      <div className={cn("relative inline-flex w-full", className)}>
        <select
          ref={ref}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "w-full appearance-none border rounded-[var(--radius)] pr-9",
            "focus:outline-none focus:border-[var(--primary)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "bg-[var(--surface)]"
          )}
          style={{
            height,
            paddingLeft: "12px",
            paddingRight: "34px",
            fontSize: size === "sm" ? "13px" : "14px",
            color: "var(--text)",
            border: "1px solid var(--border)",
            fontFamily: "var(--font)",
            ...style,
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDown
          className="absolute right-[10px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 shrink-0 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
          strokeWidth={1.5}
        />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
