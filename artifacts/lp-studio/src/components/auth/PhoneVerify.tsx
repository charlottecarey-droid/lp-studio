import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { useTurnstileSiteKey, TurnstileWidget } from "@/components/auth/EmailAuth";

/**
 * SMS phone verification step shown before workspace creation when the server
 * requires it (Task #637). Two phases:
 *   1. "enter" — the user types a mobile number; we POST /auth/phone/send-code
 *      which validates it (rejecting VOIP/landline) and texts a code. Optionally
 *      gated by Turnstile, mirroring the email auth forms.
 *   2. "code"  — the user enters the SMS code; we POST /auth/phone/verify-code
 *      which mints a single-use phone-verified token and reports whether the
 *      number has already used its free trial.
 *
 * On success calls `onVerified(token, alreadyTrialed)`; the parent then proceeds
 * to the name/slug step and includes the token in the signup request.
 */
export function PhoneVerify({
  onVerified,
}: {
  onVerified: (phoneVerifiedToken: string, alreadyTrialed: boolean) => void;
}) {
  const siteKey = useTurnstileSiteKey();
  const [phase, setPhase] = useState<"enter" | "code">("enter");
  const [phoneInput, setPhoneInput] = useState("");
  // Canonical E.164 the server sent the code to — echoed back on verify so the
  // check runs against the exact number form.
  const [canonicalPhone, setCanonicalPhone] = useState("");
  const [code, setCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // While the site key is loading we don't know whether a challenge is needed;
  // undefined = loading, null = not configured, string = required.
  const turnstileRequired = !!siteKey;
  const turnstileSatisfied = !turnstileRequired || !!turnstileToken;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/send-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput, turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.phone) {
        setCanonicalPhone(data.phone);
        setCode("");
        setPhase("code");
      } else {
        setError(data.error ?? "Could not send a code. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/verify-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: canonicalPhone, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.phoneVerifiedToken) {
        onVerified(data.phoneVerifiedToken, !!data.alreadyTrialed);
      } else {
        setError(data.error ?? "That code didn't work. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function backToEntry() {
    setPhase("enter");
    setCode("");
    setError("");
    setTurnstileToken(null);
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {phase === "enter" ? (
            <Phone className="h-6 w-6 text-primary" />
          ) : (
            <ShieldCheck className="h-6 w-6 text-primary" />
          )}
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          {phase === "enter" ? "Verify your phone" : "Enter the code"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {phase === "enter"
            ? "We'll text a code to confirm you're a real person before starting your free trial."
            : `Enter the 6-digit code we texted to ${canonicalPhone}.`}
        </p>
      </div>

      {phase === "enter" ? (
        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Include your country code. VOIP and landline numbers aren't accepted.
            </p>
          </div>

          {turnstileRequired && siteKey && (
            <TurnstileWidget siteKey={siteKey} onToken={setTurnstileToken} />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !phoneInput.trim() || !turnstileSatisfied}
          >
            {loading ? "Sending code…" : "Send code"}
          </Button>

          {/* SMS consent / proof of consent (TCPA + Twilio requirement). */}
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            By tapping “Send code,” you consent to receive a one-time
            verification code from LP Studio at the number provided via SMS. This
            is a one-time message for account verification — we won’t send
            marketing texts. Message and data rates may apply.
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sms-code">Verification code</Label>
            <Input
              id="sms-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
              maxLength={10}
              required
              autoFocus
              className="font-mono tracking-widest text-center"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || code.length < 4}>
            {loading ? "Verifying…" : "Verify & continue"}
          </Button>

          <button
            type="button"
            onClick={backToEntry}
            className="flex items-center gap-1.5 mx-auto text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Use a different number or resend
          </button>
        </form>
      )}
    </div>
  );
}
