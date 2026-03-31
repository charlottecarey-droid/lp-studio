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
        setError("Incorrect password. Please try again.");
        setPassword("");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (authed === null) return null;

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7f2] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1a3a2a] mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1a3a2a]">LP Studio</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 focus:border-[#1a3a2a] transition-all"
              placeholder="Enter password"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full h-11 rounded-xl bg-[#1a3a2a] text-white text-sm font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#152f22] transition-colors"
          >
            {loading ? "Verifying…" : "Continue"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Dandy LP Studio · Internal Tool
        </p>
      </div>
    </div>
  );
}
