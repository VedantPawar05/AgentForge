"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AgentForge Uncaught Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#08080a",
            color: "#f5f5f7",
            fontFamily: "Inter, -apple-system, sans-serif",
            padding: "24px",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "#101015",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "16px",
              padding: "32px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                display: "grid",
                placeItems: "center",
                color: "#ef4444",
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              ⚠
            </div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#fff" }}>
              Something went wrong
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#8e8e93", lineHeight: 1.5 }}>
              An unexpected error occurred in the workspace component tree. You can try refreshing
              or return to the home control plane.
            </p>
            {this.state.error?.message && (
              <div
                style={{
                  background: "#08080a",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: "12px",
                  color: "#ef4444",
                  fontFamily: "monospace",
                  textAlign: "left",
                  width: "100%",
                  maxHeight: "100px",
                  overflowY: "auto",
                }}
              >
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: "#cc0000",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.08)",
                  color: "#ccc",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

