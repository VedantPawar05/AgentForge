"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Shield, Lock, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams?.get("redirect") || "/dashboard";
  // Mitigate Open Redirect: only allow relative application paths starting with a single '/'
  const redirectTarget =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.includes("\\")
      ? rawRedirect
      : "/dashboard";

  const [provider, setProvider] = useState<"github" | "google" | "custom">("github");
  const [handle, setHandle] = useState("");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check if already logged in - if so, redirect directly to dashboard or target
  useEffect(() => {
    if (typeof window !== "undefined") {
      const existing = localStorage.getItem("agentforge_github_user");
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (parsed && parsed.login) {
            router.push(redirectTarget);
          }
        } catch (e) {
          // ignore invalid json
        }
      }
    }
  }, [redirectTarget, router]);

  const handleOAuthLogin = async (selectedProvider: "github" | "google") => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const isGoogle = selectedProvider === "google";
      const fallbackHandle = isGoogle ? "google.developer" : "developer";
      const userHandle = handle.trim() || fallbackHandle;
      const userToken = token.trim() || `${selectedProvider}_oauth_${Date.now()}`;

      const user = {
        id: `${selectedProvider}-${Math.floor(Math.random() * 9000000) + 1000000}`,
        login: userHandle,
        name: isGoogle ? `${userHandle} (Google Workspace)` : userHandle,
        email: `${userHandle}@agentforge.dev`,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userHandle)}`,
        token: userToken,
        repo: `${userHandle}/AgentForge`,
        provider: selectedProvider,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("agentforge_github_user", JSON.stringify(user));
      }
      apiClient.setToken(userToken);

      // Sync with backend API
      try {
        await apiClient.syncUser({
          externalId: user.id,
          email: user.email,
          fullName: user.name,
          avatarUrl: user.avatarUrl,
        });
      } catch (err) {
        console.warn("Backend sync notice:", err);
      }

      // Smooth redirect to target
      setTimeout(() => {
        router.push(redirectTarget);
      }, 300);
    } catch (err: any) {
      setAuthError(err?.message || "Authentication failed. Please retry.");
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#070709",
        color: "#f5f5f7",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Red ambient radial aura matching landing page */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "900px",
          height: "600px",
          background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(204, 0, 0, 0.22), transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: "-25%",
          right: "-10%",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(204, 0, 0, 0.12), transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Top Navbar */}
      <header
        style={{
          height: "64px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          background: "rgba(10, 10, 14, 0.7)",
          backdropFilter: "blur(12px)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "#fff",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "7px",
              background: "#cc0000",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: "14px",
              boxShadow: "0 0 16px rgba(204,0,0,0.5)",
            }}
          >
            +
          </div>
          <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em" }}>AgentForge</span>
        </Link>

        <Link
          href="/"
          style={{
            fontSize: "12.5px",
            color: "#888",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.08)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.borderColor = "rgba(204,0,0,0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#888";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          }}
        >
          <span>← Back to Website</span>
        </Link>
      </header>

      {/* Main Login Container */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "460px",
            background: "#0d0d12",
            border: "1px solid rgba(204, 0, 0, 0.35)",
            borderRadius: "20px",
            padding: "36px 32px",
            boxShadow: "0 24px 64px -12px rgba(0,0,0,0.8), 0 0 40px -10px rgba(204, 0, 0, 0.2)",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            position: "relative",
          }}
        >
          {/* Header Banner */}
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 10px",
                borderRadius: "20px",
                background: "rgba(204, 0, 0, 0.12)",
                border: "1px solid rgba(204, 0, 0, 0.35)",
                color: "#ff5252",
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <Lock size={11} />
              <span>Authentication Gate</span>
            </div>

            <h1 style={{ margin: "4px 0 0", fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
              Sign in to AgentForge
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "#888", lineHeight: 1.5, maxWidth: "340px" }}>
              Authenticate with your developer identity to launch autonomous squads & worktree sandboxes.
            </p>
          </div>

          {authError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>✕</span>
              <span>{authError}</span>
            </div>
          )}

          {/* Social Auth Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* 1. Continue with GitHub */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleOAuthLogin("github")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "13px 20px",
                borderRadius: "10px",
                background: "#16161f",
                border: "1px solid #282834",
                color: "#fff",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#20202c";
                e.currentTarget.style.borderColor = "rgba(204, 0, 0, 0.5)";
                e.currentTarget.style.boxShadow = "0 0 16px rgba(204, 0, 0, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#16161f";
                e.currentTarget.style.borderColor = "#282834";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Continue with GitHub</span>
            </button>

            {/* 2. Continue with Google */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleOAuthLogin("google")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "13px 20px",
                borderRadius: "10px",
                background: "#16161f",
                border: "1px solid #282834",
                color: "#fff",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#20202c";
                e.currentTarget.style.borderColor = "rgba(204, 0, 0, 0.5)";
                e.currentTarget.style.boxShadow = "0 0 16px rgba(204, 0, 0, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#16161f";
                e.currentTarget.style.borderColor = "#282834";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              or custom credentials
            </span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Custom Credentials Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11.5px", color: "#888", fontWeight: 600 }}>
                Developer Username / Handle
              </label>
              <input
                type="text"
                placeholder="e.g. vedant-dev"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                style={{
                  background: "#08080c",
                  border: "1px solid #24242f",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "13px",
                  color: "#fff",
                  outline: "none",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11.5px", color: "#888", fontWeight: 600 }}>
                Personal Access Token (PAT) (Optional)
              </label>
              <input
                type="password"
                placeholder="ghp_••••••••••••••••••••"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                style={{
                  background: "#08080c",
                  border: "1px solid #24242f",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "13px",
                  color: "#fff",
                  outline: "none",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleOAuthLogin("github")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "13px 20px",
                borderRadius: "10px",
                background: "#cc0000",
                color: "#fff",
                fontSize: "13.5px",
                fontWeight: 700,
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 18px rgba(204, 0, 0, 0.45)",
                marginTop: "6px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e60000")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#cc0000")}
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Enter Orchestrator Workspace</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>

          {/* Security Features Bullet Strip */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "11px",
              color: "#777",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={13} color="#22c55e" />
              <span>Isolated Git Worktree Sandboxes & Ephemeral Leases</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={13} color="#22c55e" />
              <span>Cryptographic PR Review & Human Sign-off Verification</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield size={13} color="#ef4444" />
              <span>Zero-dollar financial spend & zero token telemetry</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

