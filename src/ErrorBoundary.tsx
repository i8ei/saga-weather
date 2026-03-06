import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { err?: unknown }
> {
  state: { err?: unknown } = {};

  static getDerivedStateFromError(err: unknown) {
    return { err };
  }

  componentDidCatch(err: unknown) {
    console.error("Render error:", err);
  }

  render() {
    if (this.state.err) {
      const msg =
        this.state.err instanceof Error
          ? `${this.state.err.name}: ${this.state.err.message}\n${this.state.err.stack ?? ""}`
          : String(this.state.err);
      return (
        <pre style={{ whiteSpace: "pre-wrap", padding: 16, background: "#111", color: "salmon", minHeight: "100vh", margin: 0 }}>
          RENDER_ERROR{"\n"}{msg}
        </pre>
      );
    }
    return this.props.children;
  }
}
