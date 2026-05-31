// Self-serve Billing settings page.
//
// Renders a conversion-focused plan picker that mirrors the marketing
// homepage, but driven off the LIVE, SuperAdmin-editable plan config
// (`GET /api/lp/plan-config`) so prices, caps, and feature flags here can
// never drift from what the backend actually enforces. The static
// `@workspace/plan-config` is only a fallback when that fetch fails.
//
// Sections:
//   • Free-trial banner (when the Stripe subscription is `trialing`) with the
//     exact expiry date + days remaining.
//   • Current-plan card — status, price, renewal/cancel/trial-end date,
//     cadence, payment method, "Manage billing" → Stripe Billing Portal.
//   • Plan grid for EVERY tier (free → enterprise) with per-plan value detail
//     and the right CTA for the user's state:
//       - no live subscription  → Stripe Checkout for any paid self-serve tier
//       - live subscription      → Billing Portal for ANY change (upgrade,
//         downgrade, or switch to Free), because Stripe forbids swapping the
//         tier of an existing sub from Checkout
//       - enterprise             → sales-assisted (mailto)
//   • A collapsible full feature-comparison table (same info as the homepage).
//
// The tier ladder (free/starter/growth/scale/enterprise) is the single source
// of truth in @workspace/plan-config — this page must never hardcode a subset
// of tiers, or an out-of-range `plan` from the API crashes the page.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CreditCard, Check, ArrowRight, AlertTriangle, ExternalLink,
  Sparkles, ChevronDown, Clock,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import {
  PLAN_CONFIG, PLANS, type Plan, type PlanConfigEntry,
} from "@workspace/plan-config";

type Cadence = "monthly" | "annual";

interface BillingSummary {
  plan: Plan;
  features: Record<string, unknown>;
  // DB-driven 14-day Growth trial state (NOT Stripe's `trialing` status). Our
  // self-serve trials live on the tenants table and lift the effective plan to
  // Growth while active; this object drives the on-page trial messaging.
  trial: {
    active: boolean;
    expired: boolean;
    daysRemaining: number;
    startedAt: string | null;
    expiresAt: string | null;
    hasTrialedBefore: boolean;
  };
  stripe: {
    configured: boolean;
    customerId: string | null;
    subscriptionId: string | null;
    subscription: {
      status: string | null;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: number | null;
      cadence: Cadence | null;
      lookupKey: string | null;
      unitAmount: number | null;
      currency: string | null;
    } | null;
    paymentMethod: { brand: string | null; last4: string | null } | null;
  };
}

// Stripe statuses that mean the tenant has a live subscription — any plan
// change must then go through the Billing Portal, not a fresh Checkout.
const ACTIVE_SUB_STATUSES = new Set(["active", "trialing", "past_due"]);

// ── Per-tier value copy (prose only) ──────────────────────────────────────
// Kept in lockstep with the marketing homepage (Pricing.tsx). Numeric caps,
// prices, display names, and the three gated flags come from the LIVE config
// at render time — only the descriptive prose lives here. Keyed on every Plan
// so it can never be indexed out of range.
interface PlanGroup { label: string; items: string[] }

function fmtCap(n: number | null): string {
  return n === null ? "Unlimited" : n.toLocaleString();
}

function planTagline(plan: Plan): string {
  switch (plan) {
    case "free": return "Kick the tires — one real page, no card.";
    case "starter": return "Ship more than one page. Your own domain.";
    case "growth": return "Sales + marketing on one canvas. The Sales Console unlocks here.";
    case "scale": return "Multi-brand, multi-team. The whole revenue org on one canvas.";
    case "enterprise": return "For procurement-driven deals — SSO, SLA, dedicated CSM.";
    default: return "Your current plan.";
  }
}

function planIdealFor(plan: Plan): string {
  switch (plan) {
    case "free": return "Trying it out";
    case "starter": return "Founders, agencies & small teams";
    case "growth": return "Mid-market revenue teams";
    case "scale": return "Multi-brand operations & agencies";
    case "enterprise": return "Security-led organizations";
    default: return "";
  }
}

// Value groups per tier, parameterized by the LIVE config entry so caps stay
// truthful even after a SuperAdmin price/cap edit.
function planGroups(plan: Plan, e: PlanConfigEntry): PlanGroup[] {
  const L = e.features.limits;
  switch (plan) {
    case "free":
      return [{
        label: "What's included",
        items: [
          `${fmtCap(L.pages)} published landing page`,
          `${fmtCap(L.forms)} form`,
          `AI copy · ${fmtCap(L.aiGenerationsPerMonth)} generations/mo`,
          "your-brand.lpstudio.ai subdomain",
          "Email lead capture",
          '"Built with LP Studio" badge',
        ],
      }];
    case "starter":
      return [
        {
          label: "Build",
          items: [
            `${fmtCap(L.pages)} active landing pages`,
            `${fmtCap(L.forms)} forms`,
            `Up to ${fmtCap(L.userSeats)} seats`,
            "Visual builder + 124-block library",
            `AI copy · ${fmtCap(L.aiGenerationsPerMonth)} generations/mo`,
            "Your own custom domain",
            "No LP Studio badge",
          ],
        },
        {
          label: "Test & measure",
          items: [
            "Unlimited A/B variants",
            `Heatmaps · ${fmtCap(L.heatmapSessionsPerMonth)} sessions/mo`,
            "Email support",
          ],
        },
      ];
    case "growth":
      return [
        {
          label: "Everything in Starter, plus the Sales Console",
          items: [
            "Unlimited pages, forms & A/B tests",
            `Up to ${fmtCap(L.userSeats)} seats`,
            "Sales Console — microsites, AI outreach, personalized links",
            "Salesforce + Marketo bidirectional sync",
            "Apollo · Chili Piper · Asana · GA4 · Webhooks",
            `Smart Traffic + heatmaps · ${fmtCap(L.heatmapSessionsPerMonth)} sessions/mo`,
            "Brand system & locked tokens",
          ],
        },
        {
          label: "Support",
          items: ["Priority support · live chat", "Onboarding workshop"],
        },
      ];
    case "scale":
      return [
        {
          label: "Everything in Growth, plus",
          items: [
            "Multi-workspace · multi-brand",
            `Up to ${fmtCap(L.userSeats)} seats`,
            ...(e.features.aiImageGen ? ["AI image generation"] : []),
            "Custom blocks + advanced templates",
            "Programmatic pages + smart sections",
            "Salesforce custom field mapping",
            `Heatmaps · ${fmtCap(L.heatmapSessionsPerMonth)} sessions/mo`,
          ],
        },
        {
          label: "Support",
          items: ["Slack channel with founders", "Quarterly review"],
        },
      ];
    case "enterprise":
      return [{
        label: "Everything in Scale, plus",
        items: [
          "Unlimited seats & workspaces",
          "SSO / SAML",
          "SOC 2 Type II · 99.9% uptime SLA",
          "DPA & MSA · custom data residency",
          "Dedicated account manager",
          "Custom integrations",
        ],
      }];
    default:
      return [];
  }
}

function formatPaymentMethod(pm: { brand: string | null; last4: string | null } | null): string {
  if (!pm || (!pm.brand && !pm.last4)) return "—";
  const brand = pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : "Card";
  return pm.last4 ? `${brand} •••• ${pm.last4}` : brand;
}

function formatSubPrice(unitAmount: number | null, currency: string | null, cadence: string | null): string {
  if (unitAmount == null || !currency) return "—";
  const amount = (unitAmount / 100).toLocaleString(undefined, {
    style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0,
  });
  return `${amount} / ${cadence === "annual" ? "year" : "month"}`;
}

function usd(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
}

function formatDate(epochSeconds: number | null): string {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active" || status === "trialing") return "default";
  if (status === "past_due" || status === "unpaid") return "destructive";
  if (status === "canceled" || status === "incomplete_expired") return "outline";
  return "secondary";
}

export default function BillingPage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [liveConfig, setLiveConfig] = useState<PlanConfigEntry[] | null>(null);
  const [cadence, setCadence] = useState<Cadence>("annual");
  const [compareOpen, setCompareOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [downgradeOpen, setDowngradeOpen] = useState(false);

  const isAdmin = !!(user?.isAdmin || user?.permissions?.["settings"]);

  // LIVE config map (SuperAdmin-editable). Falls back to the canonical static
  // matrix for any tier the endpoint didn't return, so the grid always renders
  // the full ladder.
  const cfgMap = useMemo<Record<Plan, PlanConfigEntry>>(() => {
    const base: Record<Plan, PlanConfigEntry> = { ...PLAN_CONFIG };
    if (liveConfig) {
      for (const e of liveConfig) {
        if ((PLANS as readonly string[]).includes(e.tier)) base[e.tier] = e;
      }
    }
    return base;
  }, [liveConfig]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Live plan config (best-effort — falls back to static on failure).
      try {
        const cfgRes = await fetch("/api/lp/plan-config", { credentials: "include" });
        if (cfgRes.ok) {
          const cfgJson = (await cfgRes.json()) as { plans?: PlanConfigEntry[] };
          if (Array.isArray(cfgJson.plans)) setLiveConfig(cfgJson.plans);
        }
      } catch { /* keep static fallback */ }

      const res = await fetch("/api/billing/summary", { credentials: "include" });
      if (res.status === 503) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(json.error ?? "Billing is not configured on this deployment.");
        setSummary(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSummary((await res.json()) as BillingSummary);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Surface checkout-return status from the query string so a successful
  // upgrade shows a confirmation toast even before the webhook lands.
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("status");
    if (status === "success") {
      toast({
        title: "Checkout complete",
        description: "Your subscription is being provisioned. The page will refresh in a moment.",
      });
      setTimeout(() => { void load(); }, 1500);
      url.searchParams.delete("status");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    } else if (status === "cancelled") {
      toast({ title: "Checkout cancelled", description: "No changes to your subscription." });
      url.searchParams.delete("status");
      window.history.replaceState({}, "", url.toString());
    }
  }, [location, toast, load]);

  async function startCheckout(plan: Plan, c: Cadence): Promise<void> {
    if (!isAdmin) { toast({ title: "Workspace admin required", variant: "destructive" }); return; }
    const key = `checkout-${plan}-${c}`;
    setActionInFlight(key);
    try {
      const res = await fetch("/api/billing/checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceLookupKey: `${plan}_${c}` }),
      });
      if (res.status === 409) {
        // A live subscription already exists — tier/cadence changes must go
        // through the portal. Open it instead of dead-ending on an error.
        toast({ title: "Manage your plan", description: "Opening the billing portal to change your plan…" });
        await openPortal();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? `HTTP ${res.status}`);
      window.location.href = json.url;
    } catch (err) {
      toast({
        title: "Failed to start checkout",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      setActionInFlight(null);
    }
  }

  async function openPortal(actionKey = "portal"): Promise<void> {
    if (!isAdmin) { toast({ title: "Workspace admin required", variant: "destructive" }); return; }
    setActionInFlight(actionKey);
    try {
      const res = await fetch("/api/billing/portal-session", { method: "POST", credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? `HTTP ${res.status}`);
      window.location.href = json.url;
    } catch (err) {
      toast({
        title: "Failed to open billing portal",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      setActionInFlight(null);
    }
  }

  // End trial early / explicitly drop to the Free floor. Only meaningful when
  // there's no live subscription (the backend rejects those → use the portal).
  async function downgradeToFree(): Promise<void> {
    if (!isAdmin) { toast({ title: "Workspace admin required", variant: "destructive" }); return; }
    setActionInFlight("downgrade-free");
    try {
      const res = await fetch("/api/billing/downgrade-to-free", { method: "POST", credentials: "include" });
      if (res.status === 409) {
        // A live subscription exists — cancellation must run through the portal.
        toast({ title: "Manage your plan", description: "Opening the billing portal to cancel your subscription…" });
        setDowngradeOpen(false);
        await openPortal();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { plan?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast({
        title: "Switched to Free",
        description: "Your workspace is now on the Free plan. Upgrade any time to restore Growth features.",
      });
      setDowngradeOpen(false);
      // Refresh the on-page summary AND the global session (drives the trial
      // banner + plan gates app-wide).
      await Promise.all([load(), refresh()]);
    } catch (err) {
      toast({
        title: "Couldn't switch to Free",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionInFlight(null);
    }
  }

  const sub = summary?.stripe.subscription ?? null;
  const hasActiveSub = !!sub && !!sub.status && ACTIVE_SUB_STATUSES.has(sub.status);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              Plans &amp; billing
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your plan, payment method, and invoices.
            </p>
          </div>
          {summary && (
            <CadenceToggle cadence={cadence} onChange={setCadence} />
          )}
        </header>

        {loading && (
          <Card className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading billing summary…
          </Card>
        )}

        {errorMsg && !summary && (
          <Card className="p-6 border-amber-300 bg-amber-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-amber-900">Billing unavailable</p>
                <p className="text-sm text-amber-800">{errorMsg}</p>
              </div>
            </div>
          </Card>
        )}

        {summary && (summary.trial.active || (summary.trial.expired && summary.plan === "free")) && (
          <TrialBanner
            active={summary.trial.active}
            daysRemaining={summary.trial.daysRemaining}
            expiresAt={summary.trial.expiresAt}
            canEndTrial={isAdmin && summary.trial.active && !hasActiveSub}
            ending={actionInFlight === "downgrade-free"}
            onEndTrial={() => setDowngradeOpen(true)}
          />
        )}

        {summary && (
          <CurrentPlanCard
            summary={summary}
            cfgMap={cfgMap}
            onOpenPortal={() => openPortal()}
            portalDisabled={!isAdmin}
            portalBusy={actionInFlight === "portal"}
          />
        )}

        {summary && (
          <PlansGrid
            summary={summary}
            cfgMap={cfgMap}
            cadence={cadence}
            hasActiveSub={hasActiveSub}
            isAdmin={isAdmin}
            actionInFlight={actionInFlight}
            onCheckout={startCheckout}
            onPortal={(tier) => openPortal(`switch-${tier}`)}
            onDowngradeToFree={() => setDowngradeOpen(true)}
          />
        )}

        {summary && (
          <CompareSection
            cfgMap={cfgMap}
            currentPlan={summary.plan}
            open={compareOpen}
            onToggle={() => setCompareOpen((v) => !v)}
          />
        )}
      </div>

      <AlertDialog open={downgradeOpen} onOpenChange={setDowngradeOpen}>
        <AlertDialogContent data-testid="downgrade-free-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {summary?.trial.active ? "End your trial and switch to Free?" : "Switch to the Free plan?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {summary?.trial.active
                ? "Your Growth trial ends immediately and your workspace drops to the Free plan. You'll lose the Sales Console, unlimited pages, and your other Growth features right away. This can't be undone — but you can upgrade again any time."
                : "Your workspace moves to the Free plan. You'll keep one published page and form; anything above the Free limits stops working until you upgrade again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionInFlight === "downgrade-free"}>Keep my plan</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void downgradeToFree(); }}
              disabled={actionInFlight === "downgrade-free"}
              data-testid="downgrade-free-confirm"
            >
              {actionInFlight === "downgrade-free" && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {summary?.trial.active ? "End trial & switch to Free" : "Switch to Free"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function CadenceToggle({ cadence, onChange }: { cadence: Cadence; onChange: (c: Cadence) => void }) {
  return (
    <div className="inline-flex items-center p-1 rounded-full border border-border bg-muted/40">
      {(["monthly", "annual"] as Cadence[]).map((c) => {
        const active = cadence === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            data-testid={`billing-cadence-${c}`}
            aria-pressed={active}
            className={`relative px-4 py-1.5 text-xs font-semibold rounded-full capitalize transition-colors ${
              active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
            {c === "annual" && (
              <span className={`ml-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full align-middle ${
                active ? "bg-background/20 text-background" : "bg-primary/10 text-primary"
              }`}>
                Save 20%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// DB-driven Growth-trial banner. While the window is open it shows days
// remaining + the end date and points the user at the plans below; once it has
// lapsed (and the tenant has fallen back to Free) it explains the downgrade.
// There is no "add payment method" action — self-serve trials convert through
// the Checkout buttons in the plans grid, not a Stripe trial.
function TrialBanner({
  active, daysRemaining, expiresAt, canEndTrial, ending, onEndTrial,
}: {
  active: boolean;
  daysRemaining: number;
  expiresAt: string | null;
  canEndTrial: boolean;
  ending: boolean;
  onEndTrial: () => void;
}) {
  const endMs = expiresAt ? Date.parse(expiresAt) : null;
  const tone = active
    ? daysRemaining <= 3 ? "border-amber-300 bg-amber-50" : "border-primary/30 bg-primary/5"
    : "border-amber-300 bg-amber-50";
  const iconWrap = active && daysRemaining > 3 ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700";
  const dayLabel = daysRemaining === 1 ? "day" : "days";
  return (
    <Card className={`p-5 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconWrap}`}>
          <Clock className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          {active ? (
            <>
              <p className="font-medium text-foreground">
                You're on the Growth trial
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  · {daysRemaining} {dayLabel} left
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {endMs
                  ? `Your trial ends on ${formatDate(endMs / 1000)}. Upgrade below any time to keep your Growth features.`
                  : "Upgrade below any time to keep your Growth features."}
              </p>
              {canEndTrial && (
                <button
                  type="button"
                  onClick={onEndTrial}
                  disabled={ending}
                  data-testid="end-trial-cta"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                >
                  {ending && <Loader2 className="w-3 h-3 animate-spin" />}
                  End trial early & switch to Free
                </button>
              )}
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">Your Growth trial has ended</p>
              <p className="text-sm text-muted-foreground">
                You've been downgraded to Free. Upgrade below to restore the Sales Console, unlimited
                pages, and the rest of your Growth features.
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function CurrentPlanCard({
  summary, cfgMap, onOpenPortal, portalDisabled, portalBusy,
}: {
  summary: BillingSummary;
  cfgMap: Record<Plan, PlanConfigEntry>;
  onOpenPortal: () => void;
  portalDisabled: boolean;
  portalBusy: boolean;
}) {
  const plan = summary.plan;
  const sub = summary.stripe.subscription;
  const isPastDue = sub?.status === "past_due" || sub?.status === "unpaid";
  const isTrialing = sub?.status === "trialing";
  const dateLabel = sub?.cancelAtPeriodEnd ? "Cancels on" : isTrialing ? "Trial ends" : "Renews on";
  const displayName = cfgMap[plan]?.displayName ?? plan;

  return (
    <Card className="p-6 space-y-4">
      {isPastDue && (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-start gap-3"
          data-testid="payment-failed-banner"
        >
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-2 min-w-0">
            <div className="space-y-0.5">
              <p className="font-medium text-destructive">Your last payment failed</p>
              <p className="text-sm text-destructive/90">
                We couldn't charge {formatPaymentMethod(summary.stripe.paymentMethod)}. Update your
                payment method to keep your plan active — we'll retry the charge automatically.
              </p>
            </div>
            {summary.stripe.customerId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onOpenPortal}
                disabled={portalDisabled || portalBusy}
                data-testid="payment-failed-update-button"
              >
                {portalBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />}
                Update payment method
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{displayName}</h2>
            {sub && (
              <Badge variant={statusBadgeVariant(sub.status ?? "")} data-testid="subscription-status-badge">
                {sub.status}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{planTagline(plan)}</p>
        </div>
        {summary.stripe.customerId && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPortal}
            disabled={portalDisabled || portalBusy}
            data-testid="open-billing-portal-button"
          >
            {portalBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ExternalLink className="w-4 h-4 mr-1" />}
            Manage billing
          </Button>
        )}
      </div>

      {sub && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
            <p className="font-medium">{formatSubPrice(sub.unitAmount, sub.currency, sub.cadence)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{dateLabel}</p>
            <p className="font-medium">{formatDate(sub.currentPeriodEnd)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Billing</p>
            <p className="font-medium capitalize">{sub.cadence ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment method</p>
            <p className="font-medium" data-testid="payment-method-display">
              {formatPaymentMethod(summary.stripe.paymentMethod)}
            </p>
          </div>
        </div>
      )}

      {sub?.cancelAtPeriodEnd && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Your subscription is set to cancel at the end of the current period — you'll move to the Free
          plan on {formatDate(sub.currentPeriodEnd)}. Re-activate any time from the billing portal.
        </div>
      )}
    </Card>
  );
}

function planMonthlyDisplay(e: PlanConfigEntry, cadence: Cadence): {
  price: string; sub: string; struck: string | null; save: boolean;
} {
  if (!e.selfServe || (e.priceMonthly == null && e.priceAnnual == null)) {
    return { price: "Custom", sub: "tailored to your org", struck: null, save: false };
  }
  if (e.priceMonthly === 0 && (e.priceAnnual == null || e.priceAnnual === 0)) {
    return { price: usd(0), sub: "free forever", struck: null, save: false };
  }
  if (cadence === "annual" && e.priceAnnual != null) {
    return {
      price: `${usd(e.priceAnnual)}`,
      sub: "/mo · billed annually",
      struck: e.priceMonthly != null && e.priceMonthly > e.priceAnnual ? usd(e.priceMonthly) : null,
      save: true,
    };
  }
  return {
    price: e.priceMonthly != null ? usd(e.priceMonthly) : "—",
    sub: "/mo · billed monthly",
    struck: null,
    save: false,
  };
}

function PlansGrid({
  summary, cfgMap, cadence, hasActiveSub, isAdmin, actionInFlight, onCheckout, onPortal, onDowngradeToFree,
}: {
  summary: BillingSummary;
  cfgMap: Record<Plan, PlanConfigEntry>;
  cadence: Cadence;
  hasActiveSub: boolean;
  isAdmin: boolean;
  actionInFlight: string | null;
  onCheckout: (plan: Plan, cadence: Cadence) => void;
  onPortal: (plan: Plan) => void;
  onDowngradeToFree: () => void;
}) {
  const currentPlan = summary.plan;
  const currentOrder = cfgMap[currentPlan]?.sortOrder ?? 0;
  const stripeConfigured = summary.stripe.configured;
  // Ordered ladder, low → high.
  const ordered = [...PLANS].sort((a, b) => (cfgMap[a]?.sortOrder ?? 0) - (cfgMap[b]?.sortOrder ?? 0));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Switch plan</h2>
      {!isAdmin && (
        <div className="rounded border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Only workspace admins can change the plan.
        </div>
      )}
      {isAdmin && !stripeConfigured && (
        <div className="rounded border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Billing isn't configured on this deployment, so plan changes are disabled. Enterprise is still available via sales.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((plan) => (
          <PlanCard
            key={plan}
            plan={plan}
            entry={cfgMap[plan]}
            cadence={cadence}
            isCurrent={plan === currentPlan}
            currentOrder={currentOrder}
            hasActiveSub={hasActiveSub}
            isAdmin={isAdmin}
            stripeConfigured={stripeConfigured}
            actionInFlight={actionInFlight}
            onCheckout={onCheckout}
            onPortal={onPortal}
            onDowngradeToFree={onDowngradeToFree}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  plan, entry, cadence, isCurrent, currentOrder, hasActiveSub, isAdmin,
  stripeConfigured, actionInFlight, onCheckout, onPortal, onDowngradeToFree,
}: {
  plan: Plan;
  entry: PlanConfigEntry;
  cadence: Cadence;
  isCurrent: boolean;
  currentOrder: number;
  hasActiveSub: boolean;
  isAdmin: boolean;
  stripeConfigured: boolean;
  actionInFlight: string | null;
  onCheckout: (plan: Plan, cadence: Cadence) => void;
  onPortal: (plan: Plan) => void;
  onDowngradeToFree: () => void;
}) {
  const price = planMonthlyDisplay(entry, cadence);
  const groups = planGroups(plan, entry);
  const isEnterprise = plan === "enterprise";
  const isPopular = plan === "growth";
  const direction = entry.sortOrder > currentOrder ? "up" : "down";
  const busy = actionInFlight !== null;

  // Resolve the CTA for this card given the tenant's state.
  let cta: React.ReactNode;
  if (isCurrent) {
    cta = (
      <Button variant="outline" className="w-full" disabled data-testid={`plan-current-${plan}`}>
        <Check className="w-4 h-4 mr-1" /> Current plan
      </Button>
    );
  } else if (isEnterprise) {
    cta = (
      <Button asChild className="w-full" variant={isPopular ? "default" : "outline"}>
        <a
          href="mailto:sales@meetdandy.com?subject=LP%20Studio%20Enterprise"
          data-testid="contact-sales-enterprise"
        >
          Contact sales <ArrowRight className="w-4 h-4 ml-1" />
        </a>
      </Button>
    );
  } else if (!isAdmin) {
    cta = <Button className="w-full" variant="outline" disabled>Admins only</Button>;
  } else if (hasActiveSub) {
    // A live subscription exists → ALL tier changes (up, down, or to Free)
    // must run through the Billing Portal.
    const portalKey = `switch-${plan}`;
    const label = plan === "free" ? "Switch to Free" : direction === "up" ? `Upgrade to ${entry.displayName}` : `Switch to ${entry.displayName}`;
    cta = (
      <Button
        className="w-full"
        variant={direction === "up" ? "default" : "outline"}
        onClick={() => onPortal(plan)}
        disabled={busy || !stripeConfigured}
        data-testid={portalKey}
      >
        {actionInFlight === portalKey ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        {label}
        {actionInFlight !== portalKey && <ArrowRight className="w-4 h-4 ml-1" />}
      </Button>
    );
  } else if (plan === "free") {
    // No live subscription and not currently Free: nothing to charge or
    // cancel — but the tenant's EFFECTIVE plan is above Free (an active trial,
    // or a stored paid plan whose subscription already lapsed), so let an admin
    // explicitly drop to the Free floor / end the trial early.
    cta = (
      <Button
        className="w-full"
        variant="outline"
        onClick={onDowngradeToFree}
        disabled={busy}
        data-testid="downgrade-to-free"
      >
        {actionInFlight === "downgrade-free" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        Downgrade to Free
      </Button>
    );
  } else {
    // No live subscription → fresh Checkout for this paid self-serve tier.
    const key = `checkout-${plan}-${cadence}`;
    cta = (
      <Button
        className="w-full"
        variant={isPopular ? "default" : "outline"}
        onClick={() => onCheckout(plan, cadence)}
        disabled={busy || !stripeConfigured}
        data-testid={key}
      >
        {actionInFlight === key ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        Upgrade to {entry.displayName}
        {actionInFlight !== key && <ArrowRight className="w-4 h-4 ml-1" />}
      </Button>
    );
  }

  return (
    <Card className={`p-5 flex flex-col gap-4 ${isCurrent ? "border-primary ring-1 ring-primary/30" : isPopular ? "border-primary/40" : ""}`}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold">{entry.displayName}</span>
          {isCurrent ? (
            <Badge variant="default" className="text-[10px]">Current</Badge>
          ) : isPopular ? (
            <Badge variant="secondary" className="text-[10px] gap-1"><Sparkles className="w-3 h-3" /> Popular</Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{planIdealFor(plan)}</p>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">{price.price}</span>
          <span className="text-xs text-muted-foreground">{price.sub}</span>
        </div>
        {price.struck && (
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="line-through">{price.struck}/mo</span>{" "}
            <span className="text-primary font-medium">save 20%</span>
          </p>
        )}
      </div>

      <p className="text-sm text-muted-foreground leading-snug">{planTagline(plan)}</p>

      <div className="space-y-3 flex-1">
        {groups.map((g) => (
          <div key={g.label} className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{g.label}</p>
            <ul className="space-y-1.5">
              {g.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {cta}
    </Card>
  );
}

// ── Full feature comparison (mirrors the homepage FEATURE_MAP) ─────────────
const COMPARE_PLANS: Plan[] = ["free", "starter", "growth", "scale"];

type CompareValue = string | boolean;
interface CompareRow { feature: string; values: CompareValue[] }
interface CompareGroup { label: string; rows: CompareRow[] }

function buildCompareGroups(cfgMap: Record<Plan, PlanConfigEntry>): CompareGroup[] {
  const cap = (key: keyof PlanConfigEntry["features"]["limits"]): string[] =>
    COMPARE_PLANS.map((p) => fmtCap(cfgMap[p].features.limits[key]));
  const heat = (): string[] =>
    COMPARE_PLANS.map((p) => {
      const n = cfgMap[p].features.limits.heatmapSessionsPerMonth;
      return n === null ? "Unlimited" : `${n.toLocaleString()} sessions/mo`;
    });
  const flag = (key: "salesConsole" | "aiImageGen" | "customDomain"): boolean[] =>
    COMPARE_PLANS.map((p) => cfgMap[p].features[key]);

  return [
    {
      label: "Build",
      rows: [
        { feature: "Active landing pages", values: cap("pages") },
        { feature: "Forms", values: cap("forms") },
        { feature: "User seats", values: cap("userSeats") },
        { feature: "AI copy generations / month", values: cap("aiGenerationsPerMonth") },
        { feature: "124-block library", values: [true, true, true, true] },
        { feature: "Brand system & locked tokens", values: [false, true, true, true] },
        { feature: "Custom blocks", values: [false, false, true, true] },
        { feature: "AI image generation", values: flag("aiImageGen") },
      ],
    },
    {
      label: "Sales Console — per-account ABM",
      rows: [
        { feature: "Accounts, Contacts, Signals, Campaigns", values: flag("salesConsole") },
        { feature: "Per-account microsites (1-click)", values: flag("salesConsole") },
        { feature: "Personalized links per contact", values: flag("salesConsole") },
        { feature: "AI outreach email drafts", values: flag("salesConsole") },
        { feature: "One-pager suite (PDF + web)", values: flag("salesConsole") },
      ],
    },
    {
      label: "Integrations",
      rows: [
        { feature: "Salesforce sync", values: [false, false, true, "+ custom fields"] },
        { feature: "Marketo bidirectional", values: [false, false, true, true] },
        { feature: "Apollo signals + enrichment", values: [false, false, true, true] },
        { feature: "Chili Piper handoff", values: [false, false, true, true] },
        { feature: "Google Analytics 4 + Webhooks", values: [true, true, true, true] },
      ],
    },
    {
      label: "Test & measure",
      rows: [
        { feature: "A/B testing", values: ["Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
        { feature: "Multivariate + Smart Traffic", values: [false, false, true, true] },
        { feature: "Heatmaps & scroll depth", values: heat() },
        { feature: "Programmatic pages + smart sections", values: [false, false, false, true] },
      ],
    },
    {
      label: "Distribution",
      rows: [
        { feature: "Custom domain (auto SSL)", values: flag("customDomain") },
        { feature: 'No "Built with LP Studio" badge', values: [false, true, true, true] },
        { feature: "Multi-workspace / multi-brand", values: [false, false, false, true] },
      ],
    },
    {
      label: "Support",
      rows: [
        { feature: "Support channel", values: ["Community", "Email", "Live chat", "Slack + founders"] },
        { feature: "Onboarding", values: ["Self-serve", "Self-serve", "Workshop", "Workshop + QBR"] },
      ],
    },
  ];
}

function CompareCell({ value }: { value: CompareValue }) {
  if (value === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (value === false) return <span className="text-muted-foreground/50">—</span>;
  return <span className="text-xs">{value}</span>;
}

function CompareSection({
  cfgMap, currentPlan, open, onToggle,
}: {
  cfgMap: Record<Plan, PlanConfigEntry>;
  currentPlan: Plan;
  open: boolean;
  onToggle: () => void;
}) {
  const groups = useMemo(() => buildCompareGroups(cfgMap), [cfgMap]);
  const currentCol = COMPARE_PLANS.indexOf(currentPlan);

  return (
    <Card className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        data-testid="compare-features-toggle"
        className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Compare every feature
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b">
                <th className="text-left font-medium px-6 py-3 text-muted-foreground">Feature</th>
                {COMPARE_PLANS.map((p, i) => (
                  <th
                    key={p}
                    className={`text-center font-semibold px-3 py-3 ${i === currentCol ? "text-primary" : ""}`}
                  >
                    {cfgMap[p].displayName}
                    {i === currentCol && <span className="block text-[10px] font-normal text-primary">Current</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.label}>
                  <tr className="bg-muted/40">
                    <td colSpan={COMPARE_PLANS.length + 1} className="px-6 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={group.label + row.feature} className="border-b last:border-0">
                      <td className="px-6 py-2.5 text-foreground">{row.feature}</td>
                      {row.values.map((v, i) => (
                        <td
                          key={i}
                          className={`text-center px-3 py-2.5 ${i === currentCol ? "bg-primary/5" : ""}`}
                        >
                          <CompareCell value={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 text-xs text-muted-foreground border-t">
            Enterprise adds SSO/SAML, SOC 2 Type II, a 99.9% uptime SLA, unlimited seats &amp; workspaces, and a dedicated CSM.{" "}
            <a href="mailto:sales@meetdandy.com?subject=LP%20Studio%20Enterprise" className="text-primary underline">Talk to sales</a>.
          </div>
        </div>
      )}
    </Card>
  );
}
