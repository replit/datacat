import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, cardStyles } from "@/components/ui";

/** Shows a recoverable error panel instead of a blank page when a view throws while rendering. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null; stack: string }> {
  state: { error: Error | null; stack: string } = { error: null, stack: "" };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("DataCat view crashed:", error, info.componentStack);
    this.setState({ stack: (info.componentStack ?? "").trim().split("\n").slice(0, 12).join("\n") });
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null, stack: "" });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-10">
        <div className={cardStyles({ className: "border-alert/30 bg-red-50 p-5 max-w-2xl" })}>
          <div className="font-semibold text-alert mb-1">Something went wrong on this page</div>
          <pre className="mono text-xs whitespace-pre-wrap text-ink-2" data-testid="view-error">
            {String(this.state.error.message)}
          </pre>
          {this.state.stack && (
            <pre className="mono text-[11px] whitespace-pre-wrap text-ink-3 mt-2" data-testid="view-error-stack">
              {this.state.stack}
            </pre>
          )}
          <Button className="mt-3" onClick={() => this.setState({ error: null, stack: "" })}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
