import { useState, useEffect } from "react";

const SESSION_KEY = "lp_studio_auth";
const API_BASE = "/api";

const PUBLIC_PREFIXES = ["/lp/", "/p/", "/review/"];

function isPublicRoute(path: string) {
  return PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currentPath = window.location.pathname;

  useEffect(() => {
    if (isPublicRoute(currentPath)) {
      setAuthed(true);
      return;
    }
    setAuthed(sessionStorage.getItem(SESSION_KEY) === "1");
  }, [currentPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setAuthed(true);
      } else {
        setError("ERROR: The password you entered is incorrect.");
        setPassword("");
      }
    } catch {
      setError("ERROR: Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (authed === null) return null;
  if (authed) return <>{children}</>;

  return (
    <div
      style={{ backgroundColor: "#f0f0f1", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full" style={{ maxWidth: 320 }}>

        <div className="text-center mb-6 select-none">
          <div
            style={{
              display: "inline-block",
              background: "#1a3a2a",
              borderRadius: 14,
              padding: "10px 22px 10px",
              marginBottom: 8,
            }}
          >
            <div style={{ color: "#c8e86b", fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
              dandy
            </div>
            <div style={{ color: "#6b9e7a", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 2 }}>
              — LP Studio —
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "#fff",
              borderLeft: "4px solid #d63638",
              padding: "12px 16px",
              marginBottom: 16,
              borderRadius: 3,
              fontSize: 13,
              color: "#d63638",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            background: "#fff",
            borderRadius: 3,
            padding: "26px 24px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.13)",
          }}
        >
          <p style={{ fontSize: 20, fontWeight: 600, color: "#1d2327", marginBottom: 20, marginTop: 0 }}>
            Log in to LP Studio
          </p>

          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="lp-password"
              style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#3c434a", marginBottom: 6 }}
            >
              Password
            </label>
            <input
              id="lp-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                height: 40,
                padding: "0 12px",
                fontSize: 14,
                border: "1px solid #8c8f94",
                borderRadius: 3,
                color: "#2c3338",
                outline: "none",
                background: "#fff",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#2271b1"; e.currentTarget.style.boxShadow = "0 0 0 1px #2271b1"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#8c8f94"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: "100%",
              height: 40,
              padding: "0 16px",
              fontSize: 14,
              fontWeight: 600,
              background: loading || !password ? "#6b9e7a" : "#1a3a2a",
              color: "#fff",
              border: "none",
              borderRadius: 3,
              cursor: loading || !password ? "not-allowed" : "pointer",
              transition: "background 0.15s",
              letterSpacing: "0.01em",
            }}
          >
            {loading ? "Logging in…" : "Log In"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 12, color: "#646970", marginTop: 20 }}>
          Dandy · Internal Tool
        </p>
      </div>
    </div>
  );
}
