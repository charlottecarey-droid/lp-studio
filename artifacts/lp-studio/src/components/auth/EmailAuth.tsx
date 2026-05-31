import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUnmetPasswordRequirements } from "@/lib/password-policy";

/**
 * Email + password and passwordless (magic-link) auth forms, plus the optional
 * Cloudflare Turnstile bot challenge. Designed to sit beneath the "Continue
 * with Google" button on both the open sign-in screen and the tenant-locked
 * sign-in panel.
 *
 * Turnstile is fully optional: when the server reports no site key the widget is
 * never rendered and tokens are simply omitted (the backend skips verification).
 */

// ── Turnstile script + widget ───────────────────────────────────────────────

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (typeof window !== "undefined" && window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(s);
  });
  return turnstileScriptPromise;
}

// Module-cached so we only hit the config endpoint once per page load.
// undefined = not yet loaded, null = not configured, string = site key.
let cachedSiteKey: string | null | undefined = undefined;

export function useTurnstileSiteKey(): string | null | undefined {
  const [siteKey, setSiteKey] = useState<string | null | undefined>(cachedSiteKey);
  useEffect(() => {
    if (cachedSiteKey !== undefined) {
      setSiteKey(cachedSiteKey);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/turnstile-config")
      .then((r) => (r.ok ? r.json() : { siteKey: null }))
      .then((d: { siteKey?: string | null }) => {
        cachedSiteKey = d.siteKey ?? null;
        if (!cancelled) setSiteKey(cachedSiteKey);
      })
      .catch(() => {
        cachedSiteKey = null;
        if (!cancelled) setSiteKey(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return siteKey;
}

export function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (t: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => {
        /* If the script fails to load we leave the token null; the action will
           prompt the user to retry. */
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* widget already gone */
        }
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={ref} className="flex justify-center" />;
}

// ── Email auth forms ────────────────────────────────────────────────────────

type Method = "password" | "magic" | "forgot";

export function EmailAuthForms({ mode, allowSignup }: { mode: "signup" | "signin"; allowSignup: boolean }) {
  const siteKey = useTurnstileSiteKey();
  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  const isSignup = mode === "signup";
  const unmetPasswordRequirements = getUnmetPasswordRequirements(password);

  // Reset transient UI state whenever the parent toggles signup/signin.
  useEffect(() => {
    setMethod("password");
    setError("");
    setNotice("");
    setNeedsVerification(false);
  }, [mode]);

  // The email-sending actions (register, magic link, forgot, and resend
  // verification) are the ones we gate behind Turnstile. Login does not send an
  // email — but once we're showing the "resend confirmation" affordance we need
  // the widget so that resend (also Turnstile-gated server-side) can succeed.
  const isEmailSending =
    method === "magic" || method === "forgot" || (isSignup && method === "password") || needsVerification;
  const turnstileRequired = isEmailSending && !!siteKey;
  const turnstileSatisfied = !turnstileRequired || !!turnstileToken;

  function resetToken() {
    setTurnstileToken(null);
  }

  async function postJson(url: string, payload: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data } as { res: Response; data: any };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setNeedsVerification(false);
    if (turnstileRequired && !turnstileToken) {
      setError("Please complete the bot check below.");
      return;
    }
    setLoading(true);
    try {
      if (method === "forgot") {
        const { res, data } = await postJson("/api/auth/password/forgot", { email, turnstileToken });
        if (res.ok) setNotice(data.message ?? "If that email has an account, we've sent a reset link.");
        else setError(data.error ?? "Something went wrong. Please try again.");
        resetToken();
        return;
      }
      if (method === "magic") {
        const { res, data } = await postJson("/api/auth/magic-link", {
          email,
          turnstileToken,
          next: window.location.pathname + window.location.search,
        });
        if (res.ok) setNotice(data.message ?? "Check your inbox for your sign-in link.");
        else setError(data.error ?? "Something went wrong. Please try again.");
        resetToken();
        return;
      }
      // method === "password"
      if (isSignup) {
        const { res, data } = await postJson("/api/auth/email/register", { email, password, name, turnstileToken });
        if (res.ok) setNotice(data.message ?? "Check your inbox to confirm your email address.");
        else setError(data.error ?? "Could not create your account.");
        resetToken();
        return;
      }
      const { res, data } = await postJson("/api/auth/email/login", { email, password });
      if (res.ok) {
        // Reload so the auth context refetches the session.
        window.location.reload();
        return;
      }
      if (res.status === 403 && data.needsVerification) {
        setNeedsVerification(true);
        setError(data.error ?? "Please verify your email first.");
      } else {
        setError(data.error ?? "Invalid email or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const { res, data } = await postJson("/api/auth/email/resend-verification", { email, turnstileToken });
      if (res.ok) setNotice(data.message ?? "If that email has an account, we've sent a new confirmation link.");
      else setError(data.error ?? "Something went wrong. Please try again.");
      resetToken();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const heading =
    method === "forgot"
      ? "Reset your password"
      : method === "magic"
        ? "Email me a sign-in link"
        : isSignup
          ? "Sign up with email"
          : "Sign in with email";

  const submitLabel =
    method === "forgot"
      ? loading
        ? "Sending…"
        : "Send reset link"
      : method === "magic"
        ? loading
          ? "Sending…"
          : "Send sign-in link"
        : isSignup
          ? loading
            ? "Creating account…"
            : "Create account"
          : loading
            ? "Signing in…"
            : "Sign in";

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/70" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-muted-foreground">or {heading.toLowerCase()}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {isSignup && method === "password" && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-name">Name</Label>
            <Input
              id="auth-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {method === "password" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="auth-password">Password</Label>
              {!isSignup && (
                <button
                  type="button"
                  onClick={() => setMethod("forgot")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot?
                </button>
              )}
            </div>
            <Input
              id="auth-password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {isSignup && password.length > 0 && unmetPasswordRequirements.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Password needs {unmetPasswordRequirements.map((r) => r.label).join(", ")}.
              </p>
            )}
          </div>
        )}

        {turnstileRequired && siteKey && <TurnstileWidget siteKey={siteKey} onToken={setTurnstileToken} />}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-emerald-600">{notice}</p>}

        {needsVerification && (
          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            Resend confirmation email
          </button>
        )}

        <Button type="submit" className="w-full" disabled={loading || !email || !turnstileSatisfied}>
          {submitLabel}
        </Button>
      </form>

      <div className="flex flex-col gap-1.5 text-center text-xs text-muted-foreground">
        {method !== "magic" && (
          <button
            type="button"
            onClick={() => {
              setMethod("magic");
              setError("");
              setNotice("");
            }}
            className="font-medium text-primary hover:underline"
          >
            Email me a sign-in link instead
          </button>
        )}
        {method !== "password" && (
          <button
            type="button"
            onClick={() => {
              setMethod("password");
              setError("");
              setNotice("");
            }}
            className="font-medium text-primary hover:underline"
          >
            {isSignup && allowSignup ? "Sign up with a password instead" : "Use a password instead"}
          </button>
        )}
      </div>
    </div>
  );
}
