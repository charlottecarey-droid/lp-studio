import { useSearch } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { EmailAuthForms } from "@/components/auth/EmailAuth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function safeRedirectTarget(raw: string | null): string {
  // Only allow same-app relative paths to avoid open-redirects.
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * Standalone, barebones sign-in screen served at `/login-admin`. Linked to
 * from SuperAdminPage's "Sign in" button (`${BASE}/login-admin?redirect=...`)
 * and usable directly on dev/staging hosts (e.g. the Replit preview) where the
 * main landing flow at `/` otherwise redirects to the live site. The public
 * `/login` path now redirects to the main login/signup at `/`. On a successful
 * login EmailAuthForms reloads the page; once the session is present we forward
 * to the requested redirect target.
 */
export default function LoginPage() {
  const { user, loading } = useAuth();
  const search = useSearch();
  const redirect = safeRedirectTarget(new URLSearchParams(search).get("redirect"));

  if (user) {
    let dest = `${BASE}${redirect}`;
    // In dev/staging the SaaS app is only served when `preview=app` is present
    // (otherwise marketing paths like "/" render the marketing site). Force it
    // so a freshly logged-in operator always lands in the app, not marketing.
    // The flag is ignored entirely in production builds.
    if (import.meta.env.DEV && !/[?&]preview=/.test(dest)) {
      dest += (dest.includes("?") ? "&" : "?") + "preview=app";
    }
    window.location.href = dest;
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to your LP Studio account.
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <EmailAuthForms mode="signin" allowSignup={false} />
        )}
      </div>
    </div>
  );
}
