import { ReactNode, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import dandyLogo from "@/assets/dandy-logo.svg";
import lpLockupNavy from "@assets/lp-lockup-horizontal-navy-depth-2048_1781934486001.png";
import lpLockupCream from "@assets/lp-lockup-horizontal-cream_1781930852666.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, LogOut, Building2, Search, Sparkles, LayoutTemplate, BarChart3, ArrowRight, Loader2 } from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { EmailAuthForms } from "@/components/auth/EmailAuth";
import { PhoneVerify } from "@/components/auth/PhoneVerify";

const PUBLIC_PREFIXES = ["/lp/", "/p/", "/review/"];
const PUBLIC_EXACT = ["/reset-password"];

function isPublicRoute(path: string) {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p)) || PUBLIC_EXACT.includes(path);
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

function GitHubIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.24-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.85 1.24 1.92 1.24 3.24 0 4.63-2.81 5.65-5.49 5.95.43.37.82 1.1.82 2.22 0 1.6-.02 2.89-.02 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

/**
 * Kick off Google OAuth, preserving the current path + query string (e.g. the
 * marketing-homepage prompt handoff `/pages?new=ai&prompt=…`) across the
 * round-trip. Server-side `sanitizeNextPath` rejects anything that isn't a
 * same-origin relative path, so this can't be turned into an open redirect.
 */
function continueWithGoogle() {
  const next = window.location.pathname + window.location.search;
  const url =
    next && next !== "/"
      ? `/api/auth/google?next=${encodeURIComponent(next)}`
      : "/api/auth/google";
  window.location.href = url;
}

/**
 * Kick off GitHub OAuth, preserving the current path + query string across the
 * round-trip (same open-redirect-safe `next` handling as the Google flow).
 */
function continueWithGithub() {
  const next = window.location.pathname + window.location.search;
  const url =
    next && next !== "/"
      ? `/api/auth/github?next=${encodeURIComponent(next)}`
      : "/api/auth/github";
  window.location.href = url;
}

/**
 * Probe whether GitHub OAuth is configured server-side so we only render the
 * "Continue with GitHub" button when it will actually work (mirrors the
 * Turnstile site-key probe). Module-cached so we hit the endpoint once per page
 * load. undefined = not yet loaded; the hook returns a plain boolean.
 */
let cachedGithubEnabled: boolean | undefined = undefined;
function useGithubEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cachedGithubEnabled ?? false);
  useEffect(() => {
    if (cachedGithubEnabled !== undefined) {
      setEnabled(cachedGithubEnabled);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/github/config")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => {
        cachedGithubEnabled = !!d.enabled;
        if (!cancelled) setEnabled(cachedGithubEnabled);
      })
      .catch(() => {
        cachedGithubEnabled = false;
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
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

/**
 * LP Studio brand lockup (icon + wordmark) shown at the top of workspace
 * sign-in screens. Every workspace login except the white-labelled Dandy
 * tenant leads with this so visitors can see they're signing into LP Studio;
 * the specific workspace is named in the heading below it.
 */
function LpStudioWordmark() {
  return (
    <div className="flex items-center justify-center">
      <img src={lpLockupNavy} alt="LP Studio" className="h-9 w-auto" />
    </div>
  );
}

function SignInPanel() {
  const { domainContext } = useAuth();
  const githubEnabled = useGithubEnabled();
  const [tenantBrand, setTenantBrand] = useState<{ logoUrl?: string | null; brandName?: string | null } | null>(null);

  const isLocked = domainContext?.mode === "tenant-locked";
  const tenantSlug = domainContext?.tenantSlug ?? null;
  const isDandyTenant = isLocked && tenantSlug === "dandy";
  // Dandy-owned login hosts (ent.meetdandy.com → "dandy",
  // meetdandy-lp.com → "dandy-smb") are restricted to Google OAuth only:
  // GitHub and email/password (incl. magic-link) sign-in are hidden on these
  // tenants per Dandy's security requirement.
  const isDandyOwned = isLocked && (tenantSlug === "dandy" || tenantSlug === "dandy-smb");

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
  const title = isLocked
    ? (displayName ? `Sign in to ${displayName}` : "Sign in")
    : "Sign in";
  const subtitle = isLocked ? "Sign in to continue" : "Sign in to your workspace";

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border/80 bg-white/90 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(88,28,135,0.25)] px-8 py-10 space-y-7 text-center">
        {isDandyTenant ? (
          <img src={dandyLogo} alt="Dandy" className="mx-auto h-11" />
        ) : (
          <LpStudioWordmark />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full gap-2.5 h-11 bg-white border-border hover:bg-muted/40 text-foreground font-medium shadow-sm"
            onClick={continueWithGoogle}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          {githubEnabled && !isDandyOwned && (
            <Button
              variant="outline"
              className="w-full gap-2.5 h-11 bg-white border-border hover:bg-muted/40 text-foreground font-medium shadow-sm"
              onClick={continueWithGithub}
            >
              <GitHubIcon />
              Continue with GitHub
            </Button>
          )}

          {!isDandyOwned && (
            <div className="text-left">
              <EmailAuthForms mode="signin" allowSignup={false} />
            </div>
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

/**
 * Workspace finder — lets a member of an existing workspace get to their own
 * company's login page from the central domain. Calls the public, exact-match,
 * rate-limited `/api/auth/find-workspace` endpoint and, on an exact hit, sends
 * the browser to that workspace's canonical login host. On a near-miss the
 * endpoint returns up to a few close, high-confidence suggestions which we
 * render as clickable links; when nothing is close it shows a friendly inline
 * message.
 */
interface WorkspaceSuggestion {
  name: string;
  host: string;
  url: string;
}

// Minimum typed length before we fire a live suggestion lookup, and how long to
// wait after the last keystroke. The finder endpoint is strictly rate-limited
// (15 lookups/IP/min), so we debounce generously and only fire once the user
// pauses — typical typing stays well under the cap.
const FINDER_MIN_QUERY_LEN = 2;
const FINDER_DEBOUNCE_MS = 350;

// Normalize the finder response into a clean WorkspaceSuggestion[]. An exact hit
// (`found: true`) is surfaced as a single selectable row rather than auto-
// navigating mid-type; a near-miss returns the ranked `suggestions` array.
function parseFinderSuggestions(data: unknown, typed: string): WorkspaceSuggestion[] {
  const d = (data ?? {}) as {
    found?: boolean;
    host?: unknown;
    url?: unknown;
    suggestions?: unknown;
  };
  if (d.found && typeof d.url === "string") {
    return [{ name: typed, host: typeof d.host === "string" ? d.host : "", url: d.url }];
  }
  return Array.isArray(d.suggestions)
    ? (d.suggestions as unknown[]).filter(
        (s): s is WorkspaceSuggestion =>
          !!s &&
          typeof (s as WorkspaceSuggestion).url === "string" &&
          typeof (s as WorkspaceSuggestion).name === "string",
      )
    : [];
}

function WorkspaceFinder({ bare = false, autoFocus = false }: { bare?: boolean; autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<WorkspaceSuggestion[]>([]);
  // -1 = nothing highlighted; keyboard arrows move through the live list.
  const [activeIndex, setActiveIndex] = useState(-1);
  // Monotonic request id so a slow in-flight live lookup can't overwrite the
  // results of a newer keystroke.
  const liveSeq = useRef(0);
  // Pending debounce timer, so an explicit Find (or Escape) can cancel a not-
  // yet-fired live lookup instead of letting it fire a redundant request.
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last completed lookup, keyed by the exact trimmed query. handleSubmit reuses
  // it when the query is unchanged so a "type, pause, then click Find" flow
  // costs ONE request, not two — the finder endpoint is tightly rate-limited.
  const lastLookup = useRef<{ q: string; exactUrl: string | null; suggestions: WorkspaceSuggestion[] } | null>(null);

  const NOT_FOUND_MSG =
    "We couldn't find that workspace. Check the spelling, or ask your admin for the link.";

  function clearResults() {
    if (error) setError("");
    if (suggestions.length) setSuggestions([]);
    setActiveIndex(-1);
  }

  // Live (debounced) suggestions as the user types. Failures — including a 429
  // from the rate limiter — fail quiet here: we just don't show live results
  // and leave the explicit Find button (handleSubmit) to surface any message.
  useEffect(() => {
    const q = query.trim();
    if (q.length < FINDER_MIN_QUERY_LEN) {
      setActiveIndex(-1);
      setSuggestions([]);
      return;
    }
    const seq = ++liveSeq.current;
    liveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/find-workspace?q=${encodeURIComponent(q)}`);
        if (seq !== liveSeq.current) return; // a newer keystroke won the race
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { found?: boolean; url?: unknown };
        if (seq !== liveSeq.current) return;
        const next = parseFinderSuggestions(data, q);
        const exactUrl = data?.found && typeof data.url === "string" ? data.url : null;
        lastLookup.current = { q, exactUrl, suggestions: next };
        setSuggestions(next);
        setActiveIndex(-1);
      } catch {
        /* network hiccup — stay silent while typing */
      }
    }, FINDER_DEBOUNCE_MS);
    return () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
    };
  }, [query]);

  function selectSuggestion(s: WorkspaceSuggestion) {
    window.location.href = s.url;
  }

  // Cancel any pending/in-flight live lookup so it can't fire a redundant
  // request or repopulate the list after an explicit action.
  function cancelLiveLookup() {
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveSeq.current++;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
      cancelLiveLookup();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    // If a suggestion is highlighted, Enter selects it instead of re-querying.
    if (activeIndex >= 0 && activeIndex < suggestions.length) {
      selectSuggestion(suggestions[activeIndex]);
      return;
    }
    // Reuse a fresh live result for this exact query — the debounced lookup has
    // almost always already run by the time the user clicks Find, so this
    // avoids a second hit on the rate-limited endpoint.
    const cached = lastLookup.current;
    if (cached && cached.q === q) {
      cancelLiveLookup();
      if (cached.exactUrl) {
        selectSuggestion({ name: q, host: "", url: cached.exactUrl });
        return;
      }
      if (cached.suggestions.length) {
        setSuggestions(cached.suggestions);
        setActiveIndex(-1);
        return;
      }
      setSuggestions([]);
      setError(NOT_FOUND_MSG);
      return;
    }
    setLoading(true);
    setError("");
    // freeze live updates while the explicit lookup runs
    cancelLiveLookup();
    try {
      const res = await fetch(`/api/auth/find-workspace?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.found && data?.url) {
        lastLookup.current = { q, exactUrl: data.url as string, suggestions: [] };
        window.location.href = data.url as string;
        return;
      }
      const nextSuggestions = parseFinderSuggestions(data, q);
      if (res.ok) lastLookup.current = { q, exactUrl: null, suggestions: nextSuggestions };
      if (res.ok && nextSuggestions.length) {
        setSuggestions(nextSuggestions);
        setActiveIndex(-1);
        return;
      }
      setSuggestions([]);
      setError(NOT_FOUND_MSG);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const listboxId = "workspace-finder-suggestions";
  const hasSuggestions = suggestions.length > 0;

  return (
    <div className={bare ? "" : "rounded-xl border border-border/70 bg-muted/30 px-4 py-4"}>
      {!bare && (
        <>
          <p className="text-sm font-medium text-foreground">Already have a workspace?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Find your company's login page.
          </p>
        </>
      )}
      <form onSubmit={handleSubmit} className={`flex items-center gap-2 ${bare ? "" : "mt-3"}`}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (error) setError(""); }}
            onKeyDown={handleKeyDown}
            placeholder="Company name or workspace"
            className="pl-8 h-10 bg-white"
            aria-label="Company name or workspace"
            role="combobox"
            aria-expanded={hasSuggestions}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
            }
            autoComplete="off"
            autoFocus={autoFocus}
          />
        </div>
        <Button type="submit" variant="outline" className="h-10 shrink-0 gap-1.5 bg-white" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Find
        </Button>
      </form>
      {hasSuggestions && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Did you mean:</p>
          <ul id={listboxId} role="listbox" className="mt-1.5 flex flex-col gap-1.5">
            {suggestions.map((s, i) => (
              <li key={s.url} role="presentation">
                <a
                  id={`${listboxId}-option-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  href={s.url}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    i === activeIndex
                      ? "border-primary/50 bg-muted/40"
                      : "border-border/70 bg-white hover:border-primary/50 hover:bg-muted/40"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.host}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Central (open-domain, `mode === "open"`) sign-in / sign-up screen. A
 * professional split-screen: a branded LP Studio panel (tagline + product
 * highlights over the violet→coral gradient) on the left, the auth card on the
 * right. Collapses to a single centered column on mobile. Google remains the
 * only identity provider — the Sign in / Sign up toggle is purely a framing
 * device that adapts the heading/subcopy while the action stays the same.
 *
 * Brand/tenant-locked screens intentionally do NOT use this — they keep the
 * minimal BrandBackdrop + SignInPanel treatment.
 */
const OPEN_HIGHLIGHTS = [
  { icon: Sparkles, title: "AI-built, on-brand", desc: "Describe a page and get a polished, on-brand draft in minutes." },
  { icon: LayoutTemplate, title: "Templates & microsites", desc: "Launch landing pages, microsites, and one-pagers from a shared library." },
  { icon: BarChart3, title: "Convert & measure", desc: "A/B test, capture leads, and track what's working — all in one place." },
];

function OpenSignInScreen() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [finderOpen, setFinderOpen] = useState(false);
  const githubEnabled = useGithubEnabled();
  const reduceMotion = useReducedMotion();
  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background">
      {/* ── Left: branded LP Studio panel (desktop only) ───────────────── */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[hsl(242_55%_22%)] via-[hsl(244_50%_29%)] to-[hsl(14_70%_42%)] px-12 py-14 text-white">
        {/* Decorative blurred blobs + faint grid, purely visual */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full bg-[hsl(14_88%_64%/0.35)] blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <div className="relative z-10 flex items-center">
          <img src={lpLockupCream} alt="LP Studio" className="h-9 w-auto" />
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            The AI revenue workspace for landing pages that convert.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            LP Studio is where marketing and sales teams build on-brand landing
            pages, microsites, and outreach in minutes — no brief, no dev queue,
            no design bottleneck.
          </p>

          <ul className="mt-8 space-y-5">
            {OPEN_HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs leading-relaxed text-white/70">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} LP Studio
        </p>
      </div>

      {/* ── Right: auth card column ─────────────────────────────────────── */}
      <div className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        {/* Soft tinted backdrop on mobile so the page never reads as a bare card */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#f5f3ff] via-white to-[#fff5f1] lg:hidden"
        />
        <div className="relative z-10 w-full max-w-md space-y-7">
          {/* Mobile logo (the branded panel is hidden < lg) */}
          <img src={lpLockupNavy} alt="LP Studio" className="mx-auto h-10 w-auto lg:hidden" />

          {/* Sign in / Sign up toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("signup")}
              aria-pressed={isSignup}
              className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                isSignup ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              aria-pressed={!isSignup}
              className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                !isSignup ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Log in
            </button>
          </div>

          <div className="rounded-2xl border border-border/80 bg-white shadow-[0_24px_60px_-24px_rgba(88,28,135,0.25)] px-7 py-8 space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {isSignup ? "Create your workspace" : "Welcome back"}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 mx-auto max-w-xs">
                {isSignup
                  ? "Start building landing pages in minutes — it's free to get started."
                  : "Log in to your LP Studio workspace to keep building."}
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2.5 h-11 bg-white border-border hover:bg-muted/40 text-foreground font-medium shadow-sm"
              onClick={continueWithGoogle}
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            {githubEnabled && (
              <Button
                variant="outline"
                className="w-full gap-2.5 h-11 bg-white border-border hover:bg-muted/40 text-foreground font-medium shadow-sm"
                onClick={continueWithGithub}
              >
                <GitHubIcon />
                Continue with GitHub
              </Button>
            )}

            <EmailAuthForms mode={isSignup ? "signup" : "signin"} allowSignup />

            <p className="text-center text-xs text-muted-foreground">
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <button type="button" onClick={() => setMode("signin")} className="font-medium text-primary hover:underline">
                    Log in
                  </button>
                </>
              ) : (
                <>
                  New to LP Studio?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                    Create a workspace
                  </button>
                </>
              )}
            </p>

            {!isSignup && (
              <div className="border-t border-border/60 pt-5">
                <AnimatePresence initial={false} mode="wait">
                  {finderOpen ? (
                    <motion.div
                      key="finder"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={reduceMotion ? undefined : { height: "auto", opacity: 1 }}
                      exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">Find your company's login page</p>
                          <button
                            type="button"
                            onClick={() => setFinderOpen(false)}
                            className="text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                        <WorkspaceFinder bare autoFocus />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.p
                      key="link"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={reduceMotion ? undefined : { height: "auto", opacity: 1 }}
                      exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      style={{ overflow: "hidden" }}
                      className="text-center text-xs text-muted-foreground"
                    >
                      Already have a workspace?{" "}
                      <button
                        type="button"
                        onClick={() => setFinderOpen(true)}
                        className="font-medium text-primary hover:underline"
                      >
                        Find your company's login page
                      </button>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to LP Studio's{" "}
            <a href="https://lpstudio.ai/terms" className="hover:text-foreground underline-offset-2 hover:underline">Terms</a>{" "}
            and{" "}
            <a href="https://lpstudio.ai/privacy" className="hover:text-foreground underline-offset-2 hover:underline">Privacy Policy</a>.
          </p>
        </div>
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

  // Trial phone gate (Task #637). `phoneRequired` is undefined until the server
  // tells us whether SMS verification is enabled (Twilio configured). When
  // required, the user must verify a mobile number before the name/slug step;
  // the resulting single-use token rides along in the signup request.
  const [phoneRequired, setPhoneRequired] = useState<boolean | undefined>(undefined);
  const [phoneToken, setPhoneToken] = useState<string | null>(null);
  const [phoneAlreadyTrialed, setPhoneAlreadyTrialed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/phone/config", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { required: false }))
      .then((d: { required?: boolean }) => {
        if (!cancelled) setPhoneRequired(!!d.required);
      })
      .catch(() => {
        if (!cancelled) setPhoneRequired(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        body: JSON.stringify({ name, slug, phoneVerifiedToken: phoneToken }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        // The verification token expired between verify and submit — send the
        // user back to re-verify rather than showing a dead-end error.
        if (data.code === "phone_verification_required") {
          setPhoneToken(null);
          setError("Your phone verification expired. Please verify again.");
        } else {
          setError(data.error ?? "Could not create workspace");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Waiting on the phone-config check — avoid flashing the wrong step.
  if (phoneRequired === undefined) {
    return (
      <div className="w-full max-w-sm flex justify-center py-10">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Phone verification required and not yet completed — show the SMS step first.
  if (phoneRequired && !phoneToken) {
    return (
      <PhoneVerify
        onVerified={(token, alreadyTrialed) => {
          setPhoneToken(token);
          setPhoneAlreadyTrialed(alreadyTrialed);
        }}
      />
    );
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

      {phoneAlreadyTrialed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This number has already used its free trial. Your workspace will be created on
          the free plan — you can upgrade anytime.
        </div>
      )}

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
    // Central (open) domain — professional split-screen sign-up / log-in.
    // Tenant-locked / microsite hosts keep the minimal backdrop + card.
    if (domainContext?.mode === "open") {
      return <OpenSignInScreen />;
    }
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
    return (
      <BrandBackdrop>
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border/80 bg-white/90 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(88,28,135,0.25)] px-8 py-10 space-y-6 text-center">
            {isDandyTenant ? (
              <img src={dandyLogo} alt="Dandy" className="mx-auto h-11" />
            ) : (
              <LpStudioWordmark />
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
