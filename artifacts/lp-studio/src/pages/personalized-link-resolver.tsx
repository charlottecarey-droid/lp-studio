import { useEffect, useState } from "react";
import { useParams } from "wouter";

const API_BASE = "/api";

interface ResolveResponse {
  pageSlug: string;
  pageTitle: string;
  contactName: string;
  token: string;
  linkId: number;
  visitId: number;
}

export default function PersonalizedLinkResolver() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Invalid link"); return; }

    fetch(`${API_BASE}/lp/resolve-token/${token}`)
      .then(async res => {
        if (!res.ok) throw new Error("Link not found");
        return res.json() as Promise<ResolveResponse>;
      })
      .then(data => {
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        window.location.replace(`${base}/lp/${data.pageSlug}?_plToken=${encodeURIComponent(data.token)}`);
      })
      .catch(() => {
        setError("This link is invalid or has expired.");
      });
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Link Not Found</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Loading your page…</p>
      </div>
    </div>
  );
}
