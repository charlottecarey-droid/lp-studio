import { useState, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, ExternalLink } from "lucide-react";
import dandyLogo from "@/assets/dandy-logo.svg";

const SESSION_KEY = "dandy_admin_token";
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Constant key for HMAC signing (for demo purposes - in production use a secure key)
const HMAC_KEY = "dandy-admin-session-key-v1";

export function logoutAdmin() {
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

interface PasswordGateProps {
  children: ReactNode;
}

// Simple HMAC-like signature using crypto for token integrity
async function createTokenSignature(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(HMAC_KEY);
  const messageData = encoder.encode(data);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyTokenSignature(data: string, signature: string): Promise<boolean> {
  try {
    const expectedSig = await createTokenSignature(data);
    return expectedSig === signature;
  } catch {
    return false;
  }
}

function getStoredSession(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const { exp, sig } = parsed;

    // Verify expiry
    if (Date.now() > exp) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

    // Verify signature (async validation happens at component mount)
    // For now just check existence - actual verification is in component
    if (!sig) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function validateStoredSession(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;

    const { exp, sig } = JSON.parse(raw);

    // Check expiry
    if (Date.now() > exp) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

    // Verify signature
    const dataToSign = `${exp}`;
    const isValid = await verifyTokenSignature(dataToSign, sig);
    if (!isValid) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function setStoredSession() {
  try {
    const exp = Date.now() + TOKEN_EXPIRY_MS;
    const sig = await createTokenSignature(`${exp}`);
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ exp, sig })
    );
  } catch (err) {
    console.error("Failed to create session:", err);
  }
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [authenticated, setAuthenticated] = useState(getStoredSession);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate stored session on mount (verify signature)
  const [validatedOnMount, setValidatedOnMount] = useState(false);
  useEffect(() => {
    if (authenticated && !validatedOnMount) {
      validateStoredSession().then((isValid) => {
        setAuthenticated(isValid);
        setValidatedOnMount(true);
      });
    } else {
      setValidatedOnMount(true);
    }
  }, [authenticated, validatedOnMount]);

  if (authenticated && validatedOnMount) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "verify-admin-password",
        { body: { password } }
      );

      if (fnError) throw fnError;

      if (data?.valid) {
        setStoredSession();
        setAuthenticated(true);
      } else {
        setError("Incorrect password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 text-center"
      >
        <img src={dandyLogo} alt="Dandy" className="mx-auto h-10" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Admin Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter password to continue
          </p>
        </div>
        <div className="space-y-3">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
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
