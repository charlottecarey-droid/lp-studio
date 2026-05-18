import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import dandyLogo from "@/assets/dandy-logo.svg";
import lpstudioLogo from "@assets/IMG_0208_1779034101365.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, LogOut, ChevronDown, Building2 } from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";

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

/**
 * Branded backdrop for the unauthenticated screens. A soft violet→coral
 * gradient with two blurred decorative blobs and a faint grid sits behind
 * the white sign-in card, so the page reads as "LP Studio" instead of a
 * raw Tailwind shell. The gradient uses the same violet (--primary, hsl
 * 258 70% 54%) and coral (--accent) tokens defined in `index.css`.
 */
function BrandBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#f5f3ff] via-white to-[#fff5f1] px-4 py-10">
      {/* Decorative blurred shapes — purely visual, hidden from a11y tree */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-[hsl(258_70%_54%/0.18)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-[hsl(14_88%_64%/0.18)] blur-3xl"
      />
      {/* Subtle grid overlay for texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function SignInPanel() {
  const { refresh, domainContext } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [tenantBrand, setTenantBrand] = useState<{ logoUrl?: string | null; brandName?: string | null } | null>(null);

  const isLocked = domainContext?.mode === "tenant-locked";
  const tenantSlug = domainContext?.tenantSlug ?? null;
  const isDandyTenant = isLocked && tenantSlug === "dandy";

  // Fetch the tenant's published brand (logo + name) on tenant-locked sign-in pages
  // so the panel reflects the workspace the visitor is signing into, not Dandy.
  useEffect(() => {
    if (!isLocked) return;
    let cancelled = false;
    fetch(`/api/lp/brand?host=${encodeURIComponent(window.location.hostname)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (!cancelled && b) setTenantBrand(b); })
      .catch(() => { /* ignore — fall back to wordmark/name */ });
    return () => { cancelled = true; };
  }, [isLocked]);

  const displayName = tenantBrand?.brandName || domainContext?.tenantName || "";
  const customLogoUrl = isLocked ? (tenantBrand?.logoUrl ?? null) : null;
  // Only show the Dandy logo on actual Dandy tenant pages — never as a default for other tenants.
  const fallbackLogo = isLocked
    ? (isDandyTenant ? dandyLogo : null)
    : lpstudioLogo;
  const fallbackLogoAlt = isLocked
    ? (isDandyTenant ? "Dandy" : displayName || "Workspace")
    : "LP Studio";
  const title = isLocked
    ? (displayName ? `Sign in to ${displayName}` : "Sign in")
    : "LP Studio";
  const subtitle = isLocked ? "Sign in to continue" : "Sign in to your workspace";

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border/80 bg-white/90 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(88,28,135,0.25)] px-8 py-10 space-y-7 text-center">
        {customLogoUrl ? (
          <img src={customLogoUrl} alt={displayName || "Workspace"} className="mx-auto h-11 object-contain" />
        ) : fallbackLogo ? (
          <img src={fallbackLogo} alt={fallbackLogoAlt} className="mx-auto h-11" />
        ) : displayName ? (
          <p className="mx-auto text-2xl font-semibold tracking-tight text-foreground">{displayName}</p>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
        </div>

        <div className="space-y-3">
          {!showPassword ? (
            <>
              <Button
                variant="outline"
                className="w-full gap-2.5 h-11 bg-white border-border hover:bg-muted/40 text-foreground font-medium shadow-sm"
                onClick={() => {
                  // Preserve the current path + query string (e.g. the
                  // marketing-homepage prompt handoff `/pages?new=ai&prompt=…`)
                  // across the Google OAuth round-trip. Server-side
                  // `sanitizeNextPath` rejects anything that isn't a
                  // same-origin relative path, so this can't be turned into
                  // an open redirect.
                  const next = window.location.pathname + window.location.search;
                  const url = next && next !== "/"
                    ? `/api/auth/google?next=${encodeURIComponent(next)}`
                    : "/api/auth/google";
                  window.location.href = url;
                }}
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                type="button"
                onClick={() => setShowPassword(true)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in with password
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

          {isDandyTenant && (
            <a
              href="https://www.meetdandy.com"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              Looking for Dandy? Visit meetdandy.com <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {!isLocked && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          The fastest way to ship landing pages that convert.
        </p>
      )}
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
          <Label htmlFor="ws-slug">Workspace URL</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground whitespace-nowrap">https://</span>
            <Input
              id="ws-slug"
              placeholder="acme"
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              required
              className="font-mono text-sm"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">.lpstudio.ai</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Your workspace will live at{" "}
            <span className="font-mono text-foreground">
              {slug || "your-name"}.lpstudio.ai
            </span>
            . You can connect a custom domain later. Letters, numbers, and hyphens only.
          </p>
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
      <BrandBackdrop>
        <SignInPanel />
      </BrandBackdrop>
    );
  }

  if (!user.tenantId) {
    // On an open domain (e.g. app.lpstudio.ai) — let the user create a workspace
    if (domainContext?.mode === "open") {
      return (
        <BrandBackdrop>
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-border/80 bg-white/90 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(88,28,135,0.25)] px-8 py-10">
              <CreateWorkspaceForm email={user.email} onSuccess={refresh} />
            </div>
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
        </BrandBackdrop>
      );
    }

    // On a tenant-locked domain (e.g. meetdandy-lp.com) — invite-only, no self-serve signup
    const tenantSlug = domainContext?.tenantSlug ?? null;
    const isDandyTenant = tenantSlug === "dandy";
    const tenantName = domainContext?.tenantName || "";
    return (
      <BrandBackdrop>
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border/80 bg-white/90 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(88,28,135,0.25)] px-8 py-10 space-y-6 text-center">
            {isDandyTenant ? (
              <img src={dandyLogo} alt="Dandy" className="mx-auto h-11" />
            ) : tenantName ? (
              <p className="mx-auto text-2xl font-semibold tracking-tight text-foreground">{tenantName}</p>
            ) : (
              <img src={lpstudioLogo} alt="LP Studio" className="mx-auto h-11" />
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Access Pending</h1>
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
      </BrandBackdrop>
    );
  }

  // New tenant that hasn't completed onboarding yet — show the setup wizard
  if (user.onboardingCompleted === false) {
    return <OnboardingWizard onComplete={refresh} />;
  }

  // Task #132 — auto-redirect onboarded users from the open domain
  // (app.lpstudio.ai / lpstudio.ai) to their canonical tenant subdomain.
  // Server-side `shouldRedirectToTenantHost` is gated on the request host
  // being a known wildcard base, so this never fires on dev / replit hosts
  // or when the user is already on their canonical host. The handoff-code
  // flow sets the session cookie on the subdomain in one redirect.
  if (user.shouldRedirectToTenantHost && user.tenantHost) {
    return <TenantHandoffRedirect host={user.tenantHost} />;
  }

  return <>{children}</>;
}

// Task #132 — bridge component that exchanges the current session for a
// single-use code and redirects to /api/auth/accept on the tenant host.
// Falls back to a plain navigation if the handoff endpoint is unreachable
// (e.g. transient API error) so the user is never stranded.
function TenantHandoffRedirect({ host }: { host: string }) {
  useEffect(() => {
    let cancelled = false;
    // Preserve the current path + query string (e.g. the marketing-homepage
    // handoff target `/pages?new=ai&prompt=…`) across the cross-domain
    // session hand-off so the user lands on their intended destination on
    // the tenant subdomain, not the bare root. Server-side validation
    // rejects anything that isn't a same-origin relative path.
    const next = window.location.pathname + window.location.search;
    (async () => {
      try {
        const res = await fetch("/api/auth/handoff-code", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ next: next && next !== "/" ? next : undefined }),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.url) {
            window.location.replace(data.url as string);
            return;
          }
        }
      } catch { /* fall through */ }
      if (!cancelled) {
        window.location.replace(`https://${host}${next && next !== "/" ? next : "/"}`);
      }
    })();
    return () => { cancelled = true; };
  }, [host]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <div className="animate-spin h-7 w-7 border-2 border-primary border-t-transparent rounded-full" />
      <p className="text-sm text-muted-foreground">Taking you to your workspace…</p>
    </div>
  );
}
