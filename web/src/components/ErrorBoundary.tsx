import { Component, type ReactNode } from "react";
import { STORAGE_KEY } from "../notes.ts";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("App crashed:", error, info);
  }

  downloadBackup = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? "[]";
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `notes-recovery-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Backup failed:", e);
    }
  };

  reload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "var(--color-bg, #1a1917)",
          color: "var(--color-ink, #f5f4f0)",
        }}
      >
        <div style={{ maxWidth: "28rem", width: "100%" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9375rem", lineHeight: 1.5 }}>
            Notes hit an unexpected error. Your pages are still saved locally — you can download a
            backup before reloading.
          </p>
          <pre
            style={{
              marginTop: "1rem",
              padding: "0.625rem 0.75rem",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              fontFamily: "ui-monospace, monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "10rem",
              overflow: "auto",
            }}
          >
            {this.state.error.message}
          </pre>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              onClick={this.downloadBackup}
              style={{
                flex: 1,
                padding: "0.625rem 0.875rem",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "0.375rem",
                color: "inherit",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Download backup
            </button>
            <button
              onClick={this.reload}
              style={{
                flex: 1,
                padding: "0.625rem 0.875rem",
                background: "#f59e0b",
                border: "none",
                borderRadius: "0.375rem",
                color: "#1a1917",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
