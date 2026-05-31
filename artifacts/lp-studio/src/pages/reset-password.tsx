import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUnmetPasswordRequirements } from "@/lib/password-policy";

/**
 * Public password-reset page at /reset-password?token=...
 *
 * The token arrives in the emailed reset link. On success the server sets the
 * new password, marks the email verified, logs the user in, and we redirect to
 * the workspace.
 */
export default function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const unmetPasswordRequirements = getUnmetPasswordRequirements(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        setTimeout(() => {
          window.location.href = "/";
        }, 1200);
      } else {
        setError(data.error ?? "Could not reset your password. The link may have expired.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border/80 bg-white shadow-[0_24px_60px_-24px_rgba(88,28,135,0.25)] px-7 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Choose a new password</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Enter a new password for your LP Studio account.
            </p>
          </div>

          {!token ? (
            <p className="text-sm text-destructive">
              This reset link is invalid or incomplete. Please request a new one from the sign-in screen.
            </p>
          ) : done ? (
            <p className="text-sm text-emerald-600">
              Your password has been reset. Redirecting you to your workspace…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                {password.length > 0 && unmetPasswordRequirements.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Password needs {unmetPasswordRequirements.map((r) => r.label).join(", ")}.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading || !password || !confirm}>
                {loading ? "Resetting…" : "Reset password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
