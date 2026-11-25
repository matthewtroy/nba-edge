import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  error: Error | null;
}

const DEFAULT_FALLBACK = (
  <p className="text-sm text-white/60 px-2 py-3">This bet couldn&apos;t be displayed.</p>
);

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (this.props.name) {
      console.error(`[${this.props.name}]`, error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? DEFAULT_FALLBACK;
    }
    return this.props.children;
  }
}