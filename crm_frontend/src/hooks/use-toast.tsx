import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastProps {
  id?: string;
  title: string;
  description?: React.ReactNode;
  variant?: ToastVariant;
}

interface ToastContextType {
  toast: (props: ToastProps) => void;
  toasts: (ToastProps & { id: string })[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Standalone toast function for usage outside components
export function toast(props: ToastProps) {
  const event = new CustomEvent("SHOW_TOAST", { detail: props });
  document.dispatchEvent(event);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([]);

  const showToast = useCallback((props: ToastProps) => {
    const id = props.id || Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...props, id, variant: props.variant || "default" }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastProps>;
      showToast(customEvent.detail);
    };
    document.addEventListener("SHOW_TOAST", handleCustomToast);
    return () => {
      document.removeEventListener("SHOW_TOAST", handleCustomToast);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toast: showToast, toasts }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          zIndex: 9999,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              padding: "12px 16px",
              display: "flex",
              gap: 10,
              alignItems: "center",
              animation: "toast-in 150ms ease-out forwards",
            }}
          >
            {t.variant === "success" && <CheckCircle size={16} color="#22c55e" />}
            {t.variant === "destructive" && <AlertCircle size={16} color="#ef4444" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "14px", color: "#111827", fontWeight: 500 }}>{t.title}</div>
              {t.description && (
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: 2 }}>{t.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
