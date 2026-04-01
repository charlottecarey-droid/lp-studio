import { useState, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";
import dandyLogo from "@/assets/dandy-logo.svg";

const SESSION_KEY = "lp_studio_auth";
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const API_BASE = "/api";

const PUBLIC_PREFIXES = ["/lp/", "/p/", "/review/"];

function isPublicRoute(path: string) {
  return PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));
}

function getStoredSession(): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { exp } = JSON.parse(raw);
    if (Date.now() > exp) {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function setStoredSession() {
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_EXPIRY_MS });
  sessionStorage.setItem(SESSION_KEY, payload);
  localStorage.setItem(SESSION_KEY, payload);
}

export function logoutAdmin() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

interface PasswordGateProps {
  children: ReactNode;
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPublicRoute(window.location.pathname)) {
      setAuthenticated(true);
      return;
    }
    setAuthenticated(getStoredSession());
  }, []);

  if (authenticated === null) return null;
  if (authenticated) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setStoredSession();
        setAuthenticated(true);
      } else {
        setError("Incorrect password");
        setPassword("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 text-center">
        <img src={dandyLogo} alt="Dandy" className="mx-auto h-10" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter password to continue</p>
        </div>
        <div className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? "Verifying…" : "Enter"}
          </Button>
          <a
            href="https://www.meetdandy.com"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Looking for Dandy? Visit meetdandy.com <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </form>
    </div>
  );
}
