"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class SilentErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[Roselet] UI boundary caught:", error.message);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="rounded-2xl border border-white/[0.06] backdrop-blur-md p-8 text-center">
          <p className="text-sm text-slate-500">
            这部分暂时无法显示，但花圃还在。
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
