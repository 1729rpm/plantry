import { Component, type ErrorInfo, type ReactNode } from "react";

// A React error boundary: a class component (the only kind React lets catch
// render/lifecycle errors) that traps an unhandled exception from anywhere in
// its subtree and swaps in a calm fallback instead of letting it propagate to
// the root and blank the whole app. We wrap the active screen (not the tab bar)
// so a single-screen crash degrades to a recoverable card while navigation
// survives. No new dependency: this is the minimal hand-written boundary.
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  // Runs during render after a child throws: flip to the fallback. Pure and
  // synchronous, so it must not log or have side effects (that is componentDidCatch's job).
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  // Side-effect hook for the same error: log it so the failure is debuggable in
  // the console even though we never show a stack trace to the user.
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught a render error", error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="empty-state error-fallback">
          <div className="empty-state__title">Something went wrong.</div>
          <p>This screen ran into a problem. A reload usually fixes it.</p>
          <button
            type="button"
            className="btn-primary error-fallback__reload"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
