import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/shared/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-8 text-center">
          <h1 className="font-display text-xl font-semibold text-text">Something went wrong</h1>
          <p className="max-w-md text-sm text-text-muted">
            {this.state.message || "The app hit an unexpected error. Try refreshing the page."}
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
