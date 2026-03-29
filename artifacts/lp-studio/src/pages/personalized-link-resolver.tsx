import { useEffect, useState } from "react";
import { useParams } from "wouter";

const API_BASE = "/api";

interface LpResolveResponse {
  pageSlug: string;
  pageTitle: string;
  contactName: string;
  token: string;
  linkId: number;
  visitId: number;
}

interface SalesResolveResponse {
  pageSlug: string;
  pageTitle: string;
  firstName: string;
  lastName: string;
  company: string;
  contactName: string | null;
  token: string;
  hotlinkId: number;
}

export default function PersonalizedLinkResolver() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Invalid link"); return; }

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");

    // First try the LP personalized links resolver (marketing side)
    fetch(`${API_BASE}/lp/resolve-token/${token}`)
      .then(async res => {
        if (!res.ok) throw new Error("not found");
        return res.json() as Promise<LpResolveResponse>;
      })
      .then(data => {
        window.location.replace(`${base}/lp/${data.pageSlug}?_plToken=${encodeURIComponent(data.token)}`);
      })
      .catch(async () => {
        // Fallback: try the Sales Console hotlinks resolver
        try {
          const salesRes = await fetch(`${API_BASE}/sales/resolve/${token}`);
          if (!salesRes.ok) throw new Error("not found");
          const data = await salesRes.json() as SalesResolveResponse;

          // Build URL with personalization vars so the page can substitute {{company}} etc.
          const params = new URLSearchParams({ _salesToken: token });
          if (data.company) params.set("_v_company", data.company);
          if (data.firstName) params.set("_v_first_name", data.firstName);
          if (data.lastName) params.set("_v_last_name", data.lastName);

          window.location.replace(`${base}/lp/${data.pageSlug}?${params.toString()}`);
        } catch {
          setError("This link is invalid or has expired.");
        }
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
