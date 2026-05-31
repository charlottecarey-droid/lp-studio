import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Globe, AlertCircle, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { MicrositeLinksCard } from "./MicrositeLinksCard";

interface CustomDomainState {
  hostname: string | null;
  cloudflareHostnameId: string | null;
  status: string | null;
  sslStatus: string | null;
  validationRecords: Array<{ name?: string; value?: string; type?: string }> | null;
  ownershipVerification: { name?: string; value?: string; type?: string } | null;
  cnameTarget: string;
  error: string | null;
}

function isReady(state: CustomDomainState | null): boolean {
  return !!state && (state.status === "active" || state.status === "active_redeploying") && state.sslStatus === "active";
}

function statusLabel(state: CustomDomainState): { text: string; tone: "ok" | "warn" | "error" } {
  if (isReady(state)) return { text: "Active — domain is live", tone: "ok" };
  if (state.status === null) return { text: "Not attached", tone: "warn" };
  if (state.status?.startsWith("test_") || state.status === "blocked" || state.status === "pending_blocked") {
    return { text: `Blocked: ${state.status}`, tone: "error" };
  }
  return { text: `Pending — ${state.sslStatus ?? state.status}`, tone: "warn" };
}

export function DomainContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.isAdmin ?? false;
  const [state, setState] = useState<CustomDomainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [detaching, setDetaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/custom-domain/status", { credentials: "include" });
      if (res.status === 402) {
        // Drain the body so the connection can be reused; the upgrade
        // copy comes from the shared UpgradePrompt component, not the
        // server message — that's how every other gated surface works.
        await res.json().catch(() => ({}));
        setPlanLocked(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CustomDomainState;
      setState(json);
      setPlanLocked(false);
    } catch (err) {
      toast({
        title: "Failed to load custom domain",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // Poll while pending so the UI updates as Cloudflare progresses through
  // validation → active without the user having to refresh manually.
  useEffect(() => {
    if (!state?.cloudflareHostnameId || isReady(state)) return;
    const id = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(id);
  }, [state, load]);

  async function handleAttach() {
    const hostname = draft.trim().toLowerCase();
    if (!hostname) return;
    setSaving(true);
    setAttachError(null);
    try {
      const res = await fetch("/api/admin/custom-domain", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAttachError(json?.error ?? `HTTP ${res.status}`);
        return;
      }
      setState(json as CustomDomainState);
      setDraft("");
      toast({
        title: "Domain attached",
        description: "Add the CNAME record at your DNS provider to finish setup.",
      });
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Failed to attach domain");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    try {
      const res = await fetch("/api/admin/custom-domain/verify", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setState(json as CustomDomainState);
    } catch (err) {
      toast({
        title: "Verification failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  }

  async function handleDetach() {
    if (!state?.hostname) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Remove ${state.hostname}? Visitors going to that URL will stop reaching your pages immediately.`,
      );
      if (!ok) return;
    }
    setDetaching(true);
    try {
      const res = await fetch("/api/admin/custom-domain", {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setState(json as CustomDomainState);
      toast({ title: "Domain removed" });
    } catch (err) {
      toast({
        title: "Failed to remove domain",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDetaching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Custom domain</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Serve your landing pages from your own subdomain (e.g.{" "}
          <span className="font-mono">pages.acme.com</span>) instead of the default LP Studio host.
        </p>
      </div>

      {loading ? (
        <Card className="p-5">
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </Card>
      ) : planLocked ? (
        <UpgradePrompt gate="customDomain" withLayout={false} />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">Landing pages domain</h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                    The hostname that visitors see when viewing your published landing pages.
                  </p>
                </div>

                {state?.hostname ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 min-w-0 font-mono text-sm bg-muted/40 border border-border/60 rounded-md px-3 h-9 inline-flex items-center truncate"
                        title={state.hostname}
                      >
                        {state.hostname}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleVerify}
                        disabled={verifying}
                        className="shrink-0 h-9"
                        data-testid="verify-domain"
                      >
                        {verifying ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDetach}
                        disabled={!isAdmin || detaching}
                        className="shrink-0 h-9"
                        data-testid="detach-domain"
                        title={isAdmin ? "Remove this domain" : "Only admins can remove the domain"}
                      >
                        {detaching ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <><Trash2 className="w-3.5 h-3.5 mr-1.5" />Remove</>
                        )}
                      </Button>
                    </div>
                    {(() => {
                      const label = statusLabel(state);
                      return (
                        <div
                          className={
                            "text-xs inline-flex items-center gap-1.5 " +
                            (label.tone === "ok"
                              ? "text-emerald-600"
                              : label.tone === "error"
                              ? "text-destructive"
                              : "text-amber-600")
                          }
                          data-testid="domain-status"
                        >
                          {label.tone === "ok" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          {label.text}
                        </div>
                      );
                    })()}
                    {state.error && (
                      <p className="text-xs text-destructive">{state.error}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="pages.acme.com"
                        disabled={!isAdmin || saving}
                        className="font-mono text-sm h-9"
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        data-testid="domain-input"
                      />
                      <Button
                        onClick={handleAttach}
                        disabled={!isAdmin || saving || !draft.trim()}
                        className="shrink-0 h-9"
                        data-testid="attach-domain"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Attach"}
                      </Button>
                    </div>
                    {!isAdmin && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Only workspace admins can attach a custom domain.
                      </p>
                    )}
                    {attachError && (
                      <p className="text-xs text-destructive inline-flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" /> {attachError}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          {state?.hostname && !isReady(state) && (
            <Card className="p-5">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">DNS setup</h2>
                <p className="text-xs text-muted-foreground max-w-prose">
                  Add this CNAME record at your DNS provider so traffic for{" "}
                  <span className="font-mono">{state.hostname}</span> reaches LP Studio. SSL
                  activates automatically once the record propagates (usually within minutes).
                </p>
                <div className="border border-border/60 rounded-md overflow-hidden">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-normal">Type</th>
                        <th className="text-left px-3 py-2 font-normal">Name</th>
                        <th className="text-left px-3 py-2 font-normal">Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border/60">
                        <td className="px-3 py-2">CNAME</td>
                        <td className="px-3 py-2">{state.hostname}</td>
                        <td className="px-3 py-2">{state.cnameTarget}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {state.ownershipVerification && (
                  <>
                    <p className="text-xs text-muted-foreground max-w-prose">
                      If your domain is hosted on Cloudflare, also add this verification record:
                    </p>
                    <div className="border border-border/60 rounded-md overflow-hidden">
                      <table className="w-full text-xs font-mono">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="text-left px-3 py-2 font-normal">Type</th>
                            <th className="text-left px-3 py-2 font-normal">Name</th>
                            <th className="text-left px-3 py-2 font-normal">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-border/60">
                            <td className="px-3 py-2">{state.ownershipVerification.type ?? "TXT"}</td>
                            <td className="px-3 py-2 break-all">{state.ownershipVerification.name}</td>
                            <td className="px-3 py-2 break-all">{state.ownershipVerification.value}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      <MicrositeLinksCard />
    </div>
  );
}

export default function DomainPage() {
  const [location] = useLocation();
  const Layout = location.startsWith("/sales") ? SalesLayout : AppLayout;
  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6">
        <DomainContent />
      </div>
    </Layout>
  );
}
