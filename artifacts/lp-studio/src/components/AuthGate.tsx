import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import dandyLogo from "@/assets/dandy-logo.svg";
import { Button } from "@/components/ui/button";
import { ExternalLink, LogOut } from "lucide-react";

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

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
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
        <div className="w-full max-w-sm space-y-6 text-center">
          <img src={dandyLogo} alt="Dandy" className="mx-auto h-10" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">LP Studio</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in with your Dandy Google account</p>
          </div>
          <div className="space-y-3">
            <Button
              className="w-full gap-2"
              onClick={() => {
                window.location.href = "/api/auth/google";
              }}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
            <a
              href="https://www.meetdandy.com"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Looking for Dandy? Visit meetdandy.com <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!user.tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <img src={dandyLogo} alt="Dandy" className="mx-auto h-10" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Access Pending</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              You're signed in as <span className="font-medium text-foreground">{user.email}</span>, but you haven't
              been added to a workspace yet.
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
