import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { resolveFeatures } from "@/lib/plan-features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Save, Users, Globe, Plus, Trash2, RotateCcw, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { fetchBrandConfig, saveBrandConfig } from "@/lib/brand-config";
import type { SalesConsoleConfig } from "@/lib/brand-config";
import {
  describeDomainVerification, domainVerificationPillClass,
  RESEND_DOMAINS_DASHBOARD_URL,
  type DomainVerification, type DomainVerificationState,
} from "@/lib/email-domain-status";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface EmailDomainWizardState {
  domain: string | null;
  domainId: string | null;
  status: DomainVerificationState;
  records: Array<{
    record?: string; name?: string; type?: string; value?: string; ttl?: string; priority?: number; status?: string;
  }>;
  active: boolean;
}

/**
 * Self-serve custom email-domain wizard (Task #771). Lets an Enterprise tenant
 * register their OWN sending domain in Resend, publish DNS, poll verification,
 * and remove it — all without an operator touching Resend. Backed by
 * /api/lp/email-domain (Enterprise-gated). Routing stays fail-closed: until
 * Resend reports verified, the foundation resolver keeps sending from the
 * shared default. `onSync` mirrors the server-persisted domain/id back into the
 * page's draft state so a later save never clobbers it.
 */
function EmailDomainWizard({
  onSync,
}: {
  onSync: (sendingDomain: string | null, customEmailDomainId: string | null) => void;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<EmailDomainWizardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [domainInput, setDomainInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const lastSynced = useRef<string | null>(null);

  const applyState = useCallback((s: EmailDomainWizardState) => {
    setState(s);
    // Only push into the draft when the domain/id actually changed so the
    // 15s verification poll doesn't keep marking the form dirty.
    const key = `${s.domain ?? ""}|${s.domainId ?? ""}`;
    if (key !== lastSynced.current) {
      lastSynced.current = key;
      onSync(s.domain, s.domainId);
    }
  }, [onSync]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BASE}/api/lp/email-domain`);
        if (!r.ok) return;
        const data = (await r.json()) as EmailDomainWizardState;
        if (!cancelled) applyState(data);
      } catch {
        // best-effort hydrate
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applyState]);

  const doVerify = useCallback(async (silent = false) => {
    setVerifying(true);
    try {
      const r = await fetch(`${BASE}/api/lp/email-domain/verify`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        if (!silent) toast({ title: "Couldn't check status", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      applyState(data as EmailDomainWizardState);
      if (!silent) {
        if ((data as EmailDomainWizardState).status === "verified") {
          toast({ title: "Domain verified", description: "Email now sends from your own domain." });
        } else {
          toast({ title: "Still pending", description: "DNS hasn't fully propagated yet — give it a few minutes." });
        }
      }
    } catch {
      if (!silent) toast({ title: "Couldn't check status", description: "Network error.", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  }, [applyState, toast]);

  // Auto-poll while a registered domain is still unverified.
  useEffect(() => {
    if (!state?.domainId || state.active || state.status === "verified") return;
    const interval = window.setInterval(() => { void doVerify(true); }, 15000);
    return () => window.clearInterval(interval);
  }, [state?.domainId, state?.active, state?.status, doVerify]);

  const doRegister = async () => {
    const domain = domainInput.trim();
    if (!domain) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${BASE}/api/lp/email-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "Couldn't add domain", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      applyState(data as EmailDomainWizardState);
      setDomainInput("");
      toast({ title: "Domain added", description: "Publish the DNS records below, then verify." });
    } catch {
      toast({ title: "Couldn't add domain", description: "Network error.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const doRemove = async () => {
    setRemoving(true);
    try {
      const r = await fetch(`${BASE}/api/lp/email-domain`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "Couldn't remove domain", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      applyState(data as EmailDomainWizardState);
      toast({ title: "Domain removed", description: "Email now sends from the shared default domain." });
    } catch {
      toast({ title: "Couldn't remove domain", description: "Network error.", variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  const pill = describeDomainVerification(
    state?.domainId
      ? { status: state.status, domain: state.domain ?? "", checkedAt: Date.now(), provider: "resend" }
      : null,
  );
  const pillClass = domainVerificationPillClass(pill.tone);

  return (
    <Card id="sales-console-custom-email-domain" className="p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Custom Email Domain
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Send sales and notification email from your own domain. We register it with Resend and give you the DNS records to publish. Until it's verified, email keeps sending from the shared default — no broken sends.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : !state?.domainId ? (
        // Step 1 — register a domain.
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Your sending domain</Label>
            <div className="flex gap-2">
              <Input
                value={domainInput}
                onChange={e => setDomainInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void doRegister(); } }}
                placeholder="e.g. mail.yourbrand.com"
                disabled={submitting}
              />
              <Button onClick={() => void doRegister()} disabled={submitting || !domainInput.trim()} className="gap-2 shrink-0">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add domain
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use a subdomain dedicated to sending (e.g. <code>mail.yourbrand.com</code>) so it doesn't collide with your main MX records.
            </p>
          </div>
        </div>
      ) : (
        // Step 2/3 — verification + DNS records.
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{state.domain}</span>
              <Badge variant="outline" className={`text-[10px] py-0 px-1.5 font-medium ${pillClass}`} title={pill.detail}>
                {pill.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {state.status !== "verified" && (
                <Button variant="outline" size="sm" onClick={() => void doVerify(false)} disabled={verifying} className="gap-2">
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Check verification
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => void doRemove()} disabled={removing} className="gap-2 text-destructive hover:text-destructive">
                {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove
              </Button>
            </div>
          </div>

          {state.status === "verified" ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Your domain is verified. Sales and notification email now send from <strong>{state.domain}</strong>.</span>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{pill.detail} Add the records below to your DNS provider, then click <strong>Check verification</strong>. Email keeps sending from the shared default until this is verified.</span>
              </div>
              {state.records.length > 0 && (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Name / Host</th>
                        <th className="px-3 py-2 font-medium">Value</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.records.map((rec, i) => (
                        <tr key={i} className="border-t align-top">
                          <td className="px-3 py-2 whitespace-nowrap font-mono">{rec.type ?? "—"}</td>
                          <td className="px-3 py-2 font-mono break-all">{rec.name ?? "—"}</td>
                          <td className="px-3 py-2 font-mono break-all">{rec.value ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{rec.status ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {state.records.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  The <code>MX</code> record above is for bounce and complaint handling on your sending subdomain
                  (<code>{state.domain}</code>) only. It does <strong>not</strong> turn on email receiving for your
                  primary domain — your existing inbox and MX records are untouched.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

interface BrandedSubdomainState {
  subdomain: string;
  domainId: string | null;
  status: DomainVerificationState;
  active: boolean;
  provisioned: boolean;
}

/**
 * Self-serve branded email-subdomain card (Tier 2, Task #784). Lets a
 * Growth/Scale tenant provision a branded sending subdomain
 * (mail.<slug>.lpstudio.ai) in ONE click — we register it in Resend AND
 * publish its DNS into our own Cloudflare zone, so the tenant does no DNS
 * work (the key difference from the Enterprise custom-domain wizard above).
 * Backed by /api/lp/branded-email-subdomain (gated on the brandedEmailSubdomain
 * feature). Routing stays fail-closed: until Resend reports verified, the
 * resolver keeps sending from the shared default.
 */
function BrandedSubdomainCard() {
  const { toast } = useToast();
  const [state, setState] = useState<BrandedSubdomainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Auto-poll bookkeeping: count attempts so we can back off and eventually
  // pause (so we don't poll Resend forever for a subdomain whose DNS may never
  // verify). The manual "Check verification" button resumes from a paused state.
  const [pollAttempts, setPollAttempts] = useState(0);
  const [pollPaused, setPollPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BASE}/api/lp/branded-email-subdomain`);
        if (!r.ok) return;
        const data = (await r.json()) as BrandedSubdomainState;
        if (!cancelled) setState(data);
      } catch {
        // best-effort hydrate
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const doVerify = useCallback(async (silent = false) => {
    setVerifying(true);
    try {
      const r = await fetch(`${BASE}/api/lp/branded-email-subdomain/verify`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        if (!silent) toast({ title: "Couldn't check status", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      setState(data as BrandedSubdomainState);
      if (!silent) {
        if ((data as BrandedSubdomainState).status === "verified") {
          toast({ title: "Subdomain verified", description: "Email now sends from your branded subdomain." });
        } else {
          // A manual re-check restarts the auto-poll window (it may have paused).
          setPollAttempts(0);
          setPollPaused(false);
          toast({ title: "Still pending", description: "DNS is still propagating — this can take a few minutes." });
        }
      }
    } catch {
      if (!silent) toast({ title: "Couldn't check status", description: "Network error.", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  }, [toast]);

  // Auto-poll while the subdomain is provisioned but not yet verified, with a
  // gentle backoff (15s → 30s → 60s) and a hard cap so we don't poll Resend
  // forever. Once the cap is reached we pause and let the tenant resume via the
  // manual "Check verification" button (DNS that hasn't propagated after this
  // window usually needs human attention).
  const POLL_MAX_ATTEMPTS = 40; // ~28 min of checks with the backoff below (8×15s + 12×30s + 20×60s)
  useEffect(() => {
    const pending = !!state?.provisioned && !state.active && state.status !== "verified";
    if (!pending || pollPaused) return;
    if (pollAttempts >= POLL_MAX_ATTEMPTS) {
      setPollPaused(true);
      return;
    }
    const delay = pollAttempts < 8 ? 15000 : pollAttempts < 20 ? 30000 : 60000;
    const t = window.setTimeout(() => {
      setPollAttempts((n) => n + 1);
      void doVerify(true);
    }, delay);
    return () => window.clearTimeout(t);
  }, [state?.provisioned, state?.active, state?.status, pollAttempts, pollPaused, doVerify]);

  const doProvision = async () => {
    setProvisioning(true);
    try {
      const r = await fetch(`${BASE}/api/lp/branded-email-subdomain`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "Couldn't set up subdomain", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      setState(data as BrandedSubdomainState);
      // Fresh provision → restart the auto-poll window from the top.
      setPollAttempts(0);
      setPollPaused(false);
      toast({ title: "Subdomain provisioned", description: "We're verifying DNS — this usually takes a few minutes." });
    } catch {
      toast({ title: "Couldn't set up subdomain", description: "Network error.", variant: "destructive" });
    } finally {
      setProvisioning(false);
    }
  };

  const doRemove = async () => {
    setRemoving(true);
    try {
      const r = await fetch(`${BASE}/api/lp/branded-email-subdomain`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "Couldn't remove subdomain", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      setState(data as BrandedSubdomainState);
      toast({ title: "Subdomain removed", description: "Email now sends from the shared default domain." });
    } catch {
      toast({ title: "Couldn't remove subdomain", description: "Network error.", variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  const pill = describeDomainVerification(
    state?.provisioned
      ? { status: state.status, domain: state.subdomain, checkedAt: Date.now(), provider: "resend" }
      : null,
  );
  const pillClass = domainVerificationPillClass(pill.tone);

  return (
    <Card id="sales-console-branded-email-subdomain" className="p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Branded Email Subdomain
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Send sales and notification email from a branded subdomain instead of the shared default — better deliverability, no DNS work. We provision and verify it for you. Until it's verified, email keeps sending from the shared default.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : !state?.provisioned ? (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            Your branded subdomain will be{" "}
            <code className="font-mono text-xs">{state?.subdomain ?? "mail.yourbrand.lpstudio.ai"}</code>.
          </div>
          <Button onClick={() => void doProvision()} disabled={provisioning} className="gap-2">
            {provisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Set up branded subdomain
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium font-mono">{state.subdomain}</span>
              <Badge variant="outline" className={`text-[10px] py-0 px-1.5 font-medium ${pillClass}`} title={pill.detail}>
                {pill.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {state.status !== "verified" && (
                <Button variant="outline" size="sm" onClick={() => void doVerify(false)} disabled={verifying} className="gap-2">
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Check verification
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => void doRemove()} disabled={removing} className="gap-2 text-destructive hover:text-destructive">
                {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove
              </Button>
            </div>
          </div>

          {state.status === "verified" ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Your subdomain is verified. Sales and notification email now send from <strong>{state.subdomain}</strong>.</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {pill.detail}{" "}
                {pollPaused
                  ? "Automatic checking has paused — DNS can take a while to propagate. Use “Check verification” to re-check."
                  : "We're verifying the DNS automatically — no action needed."}{" "}
                Email keeps sending from the shared default until this is verified.
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * The six salesConsole fields this page owns. Everything else in
 * `config.salesConsole` (value props, AI prompt strings, one-pager defaults,
 * the route-managed brandedEmailSubdomain* triple) belongs to other surfaces —
 * the save below re-fetches the freshest config and merges ONLY these keys so
 * a save here can never clobber edits made elsewhere (same pattern as the
 * one-pager Colors editor).
 */
interface SendingDraft {
  senderName: string;
  senderLocalPart: string;
  sendingDomain: string;
  customEmailDomainId?: string;
  replyTo: string;
  notificationsLocalPart: string;
}

function toDraft(sc: SalesConsoleConfig | undefined): SendingDraft {
  return {
    senderName: sc?.senderName ?? "",
    senderLocalPart: sc?.senderLocalPart ?? "",
    sendingDomain: sc?.sendingDomain ?? "",
    customEmailDomainId: sc?.customEmailDomainId,
    replyTo: sc?.replyTo ?? "",
    notificationsLocalPart: sc?.notificationsLocalPart ?? "",
  };
}

/**
 * Settings → Email → Sending. The tenant-level "who does our email send as"
 * home: sender identity + the tier-matched sending-domain surface (Enterprise
 * = self-serve custom-domain wizard, Growth/Scale = one-click branded
 * subdomain, lower tiers = free-text domain an operator verified in Resend).
 * Moved out of Brand → Sales Console (settings consolidation Phase 1b):
 * these fields drive ALL outbound email via `resolveTenantSender` — visit
 * alerts and lead notifications too — not just sales sends.
 */
export function EmailSendingContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [draft, setDraft] = useState<SendingDraft | null>(null);
  const [saving, setSaving] = useState(false);

  // Tier logic mirrors the old Sales Console card exactly: Enterprise gets the
  // custom-domain wizard, Growth/Scale the branded subdomain (unless a custom
  // domain supersedes it), everyone else the free-text field.
  const hasCustomEmailDomain = resolveFeatures(user).customEmailDomain;
  const hasBrandedEmailSubdomain =
    resolveFeatures(user).brandedEmailSubdomain && !hasCustomEmailDomain;

  useEffect(() => {
    let cancelled = false;
    fetchBrandConfig()
      .then(cfg => { if (!cancelled) setDraft(toDraft(cfg.salesConsole)); })
      .catch(() => { if (!cancelled) setDraft(toDraft(undefined)); });
    return () => { cancelled = true; };
  }, []);

  const patch = (changes: Partial<SendingDraft>) => {
    setDraft(d => (d ? { ...d, ...changes } : d));
  };

  // Domain-verification pill next to the free-text field. Best-effort: the
  // endpoint sits behind the salesConsole plan gate, so lower tiers simply
  // don't get a pill (same behaviour the old Brand-page card had).
  const [domainVerification, setDomainVerification] = useState<DomainVerification | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/sales/brand-context");
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled && data?.domainVerification) {
          setDomainVerification(data.domainVerification as DomainVerification);
        }
      } catch {
        // best-effort — the field still works without the pill
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      // Fresh-fetch merge: never write back a stale copy of the fields other
      // pages own (the Brand page and this page share one JSONB blob).
      const fresh = await fetchBrandConfig();
      await saveBrandConfig({
        ...fresh,
        salesConsole: {
          ...(fresh.salesConsole ?? {}),
          senderName: draft.senderName,
          senderLocalPart: draft.senderLocalPart,
          sendingDomain: draft.sendingDomain,
          customEmailDomainId: draft.customEmailDomainId,
          replyTo: draft.replyTo,
          notificationsLocalPart: draft.notificationsLocalPart,
        },
      });
      toast({ title: "Sending settings saved", description: "Outbound email now uses the updated sender identity." });
    } catch {
      toast({ title: "Couldn't save", description: "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  const currentDomain = draft.sendingDomain.trim().toLowerCase();
  const domainMatchesServer =
    !!domainVerification && domainVerification.domain.toLowerCase() === currentDomain;
  const pill = describeDomainVerification(domainMatchesServer ? domainVerification : null);
  const pillClass = domainVerificationPillClass(pill.tone);

  return (
    <div className="space-y-6">
      <Card id="sales-console-sender-identity" className="p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Sender Identity
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Used as the From header on every outbound sales email, the visit-alert sender, and the brand name interpolated into AI-drafted copy. The sending domain must be verified in Resend.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Sender display name</Label>
            <Input
              value={draft.senderName}
              onChange={e => patch({ senderName: e.target.value })}
              placeholder="e.g. Acme"
            />
            <p className="text-xs text-muted-foreground">Shown as the From name. Also used as the brand name in AI-generated copy.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Sender local part</Label>
            <Input
              value={draft.senderLocalPart}
              onChange={e => patch({ senderLocalPart: e.target.value })}
              placeholder="e.g. partnerships"
            />
            <p className="text-xs text-muted-foreground">Part before the @. Combined with the sending domain to form the From address.</p>
          </div>
          {/* The free-text sending-domain field is only for tiers WITHOUT a
              self-serve email-domain feature. Enterprise uses the custom-domain
              wizard (Tier 3); Growth/Scale use the auto-provisioned branded
              subdomain card (Tier 2) — both below. */}
          {!hasCustomEmailDomain && !hasBrandedEmailSubdomain && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">Sending domain</Label>
              {currentDomain.length > 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] py-0 px-1.5 font-medium ${pillClass}`}
                  title={pill.detail}
                >
                  {pill.label}
                </Badge>
              )}
            </div>
            <Input
              value={draft.sendingDomain}
              onChange={e => patch({ sendingDomain: e.target.value })}
              placeholder="e.g. ent.example.com"
            />
            <p className="text-xs text-muted-foreground">
              Must be a verified domain in Resend.{" "}
              {currentDomain.length > 0 && domainMatchesServer && pill.tone !== "verified" && (
                <>
                  {pill.detail}{" "}
                  <a
                    href={RESEND_DOMAINS_DASHBOARD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Check DNS in Resend →
                  </a>
                </>
              )}
              {currentDomain.length > 0 && !domainMatchesServer && (
                <>Save your changes to refresh DNS verification.</>
              )}
            </p>
          </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-sm">Reply-to address</Label>
            <Input
              value={draft.replyTo}
              onChange={e => patch({ replyTo: e.target.value })}
              placeholder="e.g. sales@example.com"
            />
            <p className="text-xs text-muted-foreground">Where recipient replies land. Typically a monitored inbox.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Notifications local part</Label>
            <Input
              value={draft.notificationsLocalPart}
              onChange={e => patch({ notificationsLocalPart: e.target.value })}
              placeholder="notifications"
            />
            <p className="text-xs text-muted-foreground">From local part for visit-alert emails. Defaults to "notifications".</p>
          </div>
        </div>
      </Card>

      {hasCustomEmailDomain && (
        <EmailDomainWizard
          onSync={(sendingDomain, customEmailDomainId) =>
            patch({
              sendingDomain: sendingDomain ?? "",
              customEmailDomainId: customEmailDomainId ?? undefined,
            })
          }
        />
      )}

      {hasBrandedEmailSubdomain && <BrandedSubdomainCard />}

      <div className="sticky bottom-4 flex justify-end">
        <div className="bg-background/90 backdrop-blur-md border border-border rounded-2xl px-6 py-3 shadow-lg flex items-center gap-4">
          <p className="text-sm text-muted-foreground">Applies to all outbound email — sales sends, visit alerts and lead notifications.</p>
          <Button variant="brand" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export default EmailSendingContent;
