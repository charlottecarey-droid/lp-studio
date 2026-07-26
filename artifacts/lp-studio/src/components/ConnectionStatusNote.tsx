import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, CheckCircle2, AlertTriangle, Lock } from "lucide-react";

/**
 * Inline connection-status note for the per-form Lead routing sections
 * (settings consolidation Phase 3). Tells the form author whether leads from
 * this form will actually reach the CRM right now, instead of a static
 * "credentials live elsewhere" hint — a disconnected tenant connection
 * silently drops every lead, which is exactly what this surfaces.
 *
 * Status semantics mirror IntegrationsSettingsPage: 402 → plan-locked,
 * !ok (incl. the 404-when-absent) → disconnected, network error → unknown
 * (fail open to a plain link — never block the panel on a status fetch).
 */

type Status = "loading" | "connected" | "disconnected" | "plan-locked" | "unknown";

const PROVIDERS = {
  marketo: {
    label: "Marketo",
    // The unified marketo_connections store (Phase 2). Plan-gated: 402 for
    // tenants without the Sales Console.
    endpoint: "/api/sales/marketo/connection",
    read: (data: unknown): Status =>
      (data as { status?: string } | null)?.status === "connected" ? "connected" : "disconnected",
  },
  salesforce: {
    label: "Salesforce",
    // The ungated LP mirror of sfdc_connections — form-lead write-back runs
    // for any tier, so status should be visible to any tier too.
    endpoint: "/api/lp/integrations/salesforce",
    read: (data: unknown): Status =>
      (data as { connected?: boolean } | null)?.connected ? "connected" : "disconnected",
  },
} as const;

export function ConnectionStatusNote({ provider }: { provider: keyof typeof PROVIDERS }) {
  const def = PROVIDERS[provider];
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(def.endpoint, { credentials: "include" });
        if (cancelled) return;
        if (res.status === 402) { setStatus("plan-locked"); return; }
        if (!res.ok) { setStatus("disconnected"); return; }
        setStatus(def.read(await res.json()));
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    })();
    return () => { cancelled = true; };
  }, [def]);

  const manageLink = (
    <Link href="/settings/integrations" className="underline font-medium text-foreground">
      Settings → Integrations
    </Link>
  );

  return (
    <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2 flex items-center gap-1.5 flex-wrap">
      {status === "loading" ? (
        <><Loader2 className="w-3 h-3 animate-spin shrink-0" /> Checking {def.label} connection…</>
      ) : status === "connected" ? (
        <><CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
          <span><span className="text-emerald-600 font-medium">{def.label} connected</span> — manage it in {manageLink}.</span></>
      ) : status === "plan-locked" ? (
        <><Lock className="w-3 h-3 shrink-0" />
          <span>{def.label} requires a higher plan — see {manageLink}.</span></>
      ) : status === "disconnected" ? (
        <><AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
          <span><span className="text-amber-600 font-medium">{def.label} is not connected</span> — leads from this form won't sync until you connect it in {manageLink}.</span></>
      ) : (
        <span>The {def.label} connection is managed in {manageLink}.</span>
      )}
    </p>
  );
}
