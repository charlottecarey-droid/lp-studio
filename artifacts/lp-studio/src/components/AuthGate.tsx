import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import dandyLogo from "@/assets/dandy-logo.svg";
import lpstudioLogo from "@/assets/lpstudio-logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, LogOut, ChevronDown, Building2 } from "lucide-react";

const PUBLIC_PREFIXES = ["/lp/", "/p/", "/review/"];

function isPublicRoute(path: string) {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function PasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Sign in failed");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        type="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
      />
      <Input
        type="password"
        placeholder="Admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || !email || !password}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignInPanel() {
  const { refresh, domainContext } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const isDandy = domainContext?.mode === "tenant-locked";
  const logo = isDandy ? dandyLogo : lpstudioLogo;
  const logoAlt = isDandy ? "Dandy" : "LP Studio";
  const title = isDandy ? "Dandy Admin" : "LP Studio";
  const subtitle = isDandy ? "Sign in to continue" : "Sign in to your workspace";

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <img src={logo} alt={logoAlt} className="mx-auto h-10" />
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {!showPassword ? (
          <>
            <Button
              className="w-full gap-2"
              onClick={() => { window.location.href = "/api/auth/google"; }}
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <button
              type="button"
              onClick={() => setShowPassword(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in with password instead
              <ChevronDown className="w-3 h-3" />
            </button>
          </>
        ) : (
          <>
            <PasswordForm onSuccess={refresh} />
            <button
              type="button"
              onClick={() => setShowPassword(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Google sign-in
            </button>
          </>
        )}

        {isDandy && (
          <a
            href="https://www.meetdandy.com"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Looking for Dandy? Visit meetdandy.com <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function CreateWorkspaceForm({ email, onSuccess }: { email: string; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slugEdited && name) {
      setSlug(slugify(name));
    }
  }, [name, slugEdited]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not create workspace");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Create your workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input
            id="ws-name"
            placeholder="Acme Corp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ws-slug">URL slug</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground whitespace-nowrap">lpstudio.ai/</span>
            <Input
              id="ws-slug"
              placeholder="acme-corp"
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              required
              className="font-mono text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">Letters, numbers, and hyphens only</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading || !name || !slug}>
          {loading ? "Creating workspace…" : "Create workspace"}
        </Button>
      </form>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, domainContext, logout, refresh } = useAuth();
  const [location] = useLocation();

  if (isPublicRoute(location)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-7 w-7 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <SignInPanel />
      </div>
    );
  }

  if (!user.tenantId) {
    // On an open domain (e.g. app.lpstudio.ai) — let the user create a workspace
    if (domainContext?.mode === "open") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="w-full max-w-sm">
            <CreateWorkspaceForm email={user.email} onSuccess={refresh} />
            <div className="mt-6 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={async () => {
                  await logout();
                  window.location.reload();
                }}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // On a tenant-locked domain (e.g. meetdandy-lp.com) — invite-only, no self-serve signup
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <img src={dandyLogo} alt="LP Studio" className="mx-auto h-10" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Access Pending</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              You're signed in as <span className="font-medium text-foreground">{user.email}</span>,
              but you haven't been added to this workspace yet.
              <br />
              Ask an admin to invite you.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={async () => {
              await logout();
              window.location.reload();
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
