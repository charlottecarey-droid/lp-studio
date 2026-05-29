// Self-serve Billing settings page.
//
// Renders:
//   • Current plan card (display name + feature bullets from PLAN_CONFIG)
//   • Subscription status (trialing / active / past_due / canceled / etc.)
//   • Renewal/cancel date and cadence (monthly | annual)
//   • Upgrade controls for every higher self-serve tier (starter / growth /
//     scale), monthly + annual, driven off the shared PLAN_CONFIG
//   • "Manage billing" → Stripe Billing Portal for active subscribers
//
// Treats Stripe-not-configured (503 from the API) as a soft-disable: shows
// the current plan but hides upgrade controls and tells the operator to
// enable billing in env.
//
// The tier ladder (free/starter/growth/scale/enterprise) is the single
// source of truth in @workspace/plan-config — this page must never hardcode
// a subset of tiers, or an out-of-range `plan` from the API crashes the page
// (the classic "undefined is not an object" on PLAN_COPY[plan]).
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Check, ArrowRight, AlertTriangle, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { PLAN_CONFIG, PLANS, type Plan } from "@workspace/plan-config";

type Cadence = "monthly" | "annual";

interface BillingSummary {
  plan: Plan;
  features: Record<string, unknown>;
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

interface PlanCopy {
  tagline: string;
  bullets: string[];
}

// Curated marketing copy per tier. Display names + prices come from
// PLAN_CONFIG; this only holds the tagline + bullets. Keyed on every Plan so
// it can never be indexed out of range.
const PLAN_COPY: Record<Plan, PlanCopy> = {
  free: {
    tagline: "Free — one landing page on a workspace subdomain.",
    bullets: ["1 published landing page", "lp-studio.app subdomain", "Email lead capture"],
  },
  starter: {
    tagline: "For getting a real presence live, your own domain.",
    bullets: ["Up to 10 landing pages", "Custom domain", "Email lead capture", "5 forms"],
  },
  growth: {
    tagline: "For teams running active acquisition.",
    bullets: ["Unlimited landing pages", "Custom domains", "Sales Console", "Block library", "Priority support"],
  },
  scale: {
    tagline: "For high-volume teams that need AI + more seats.",
    bullets: ["Everything in Growth", "AI image generation", "Up to 25 seats", "Higher heatmap limits"],
  },
  enterprise: {
    tagline: "Custom — SSO, white-glove onboarding, dedicated success.",
    bullets: ["Everything in Scale", "SSO + SCIM", "Custom block templates", "Dedicated CSM"],
  },
};

const FALLBACK_COPY: PlanCopy = {
  tagline: "Your current plan.",
  bullets: [],
};

function planDisplayName(plan: Plan): string {
  return PLAN_CONFIG[plan]?.displayName ?? plan;
}

function planCopy(plan: Plan): PlanCopy {
  return PLAN_COPY[plan] ?? FALLBACK_COPY;
}

function formatPaymentMethod(pm: { brand: string | null; last4: string | null } | null): string {
  if (!pm || (!pm.brand && !pm.last4)) return "—";
  const brand = pm.brand
    ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)
    : "Card";
  return pm.last4 ? `${brand} •••• ${pm.last4}` : brand;
}

function formatPrice(unitAmount: number | null, currency: string | null, cadence: string | null): string {
  if (unitAmount == null || !currency) return "—";
  const amount = (unitAmount / 100).toLocaleString(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  });
  return `${amount} / ${cadence === "annual" ? "year" : "month"}`;
}

function usd(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
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

// Self-serve paid tiers strictly above the current plan, in ladder order.
// `free` is the floor (no checkout) and `enterprise` is sales-assisted, so
// neither is ever an upgrade *target* here.
function upgradeTargets(currentPlan: Plan): Plan[] {
  const current = PLAN_CONFIG[currentPlan]?.sortOrder ?? 0;
  return PLANS.filter((p) => {
    const cfg = PLAN_CONFIG[p];
    return cfg && cfg.selfServe && p !== "free" && cfg.sortOrder > current;
  });
}

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const isAdmin = !!(user?.isAdmin || user?.permissions?.["settings"]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/billing/summary", { credentials: "include" });
      if (res.status === 503) {
        // Stripe-not-configured — render a degraded page instead of erroring.
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
      // Re-poll after a short delay so the plan flip from the webhook is
      // visible without a manual reload.
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

  async function startCheckout(plan: Plan, cadence: Cadence): Promise<void> {
    if (!isAdmin) {
      toast({ title: "Workspace admin required", variant: "destructive" });
      return;
    }
    const key = `checkout-${plan}-${cadence}`;
    setActionInFlight(key);
    try {
      const priceLookupKey = `${plan}_${cadence}`;
      const res = await fetch("/api/billing/checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceLookupKey }),
      });
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

  async function openPortal(): Promise<void> {
    if (!isAdmin) { toast({ title: "Workspace admin required", variant: "destructive" }); return; }
    setActionInFlight("portal");
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

  const targets = summary ? upgradeTargets(summary.plan) : [];
  const showEnterpriseUpsell =
    !!summary && summary.plan !== "enterprise" && targets.length === 0;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
            Billing
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your plan, payment method, and invoices.
          </p>
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

        {summary && <CurrentPlanCard summary={summary} onOpenPortal={openPortal} portalDisabled={!isAdmin} portalBusy={actionInFlight === "portal"} />}

        {summary && targets.length > 0 && (
          <UpgradeCard
            targets={targets}
            disabled={!isAdmin || !summary.stripe.configured}
            disabledReason={
              !isAdmin
                ? "Only workspace admins can upgrade."
                : !summary.stripe.configured
                  ? "Billing is not configured on this deployment."
                  : null
            }
            onCheckout={startCheckout}
            busy={actionInFlight}
          />
        )}

        {showEnterpriseUpsell && (
          <Card className="p-5 text-sm text-muted-foreground">
            You're on the {planDisplayName(summary.plan)} plan. Need SSO, custom blocks, or a dedicated CSM?{" "}
            <a href="mailto:sales@meetdandy.com?subject=LP%20Studio%20Enterprise" className="text-primary underline">
              Talk to sales about Enterprise.
            </a>
          </Card>
        )}

        {summary && summary.plan === "enterprise" && (
          <Card className="p-5 text-sm text-muted-foreground">
            You're on the Enterprise plan. Reach your account team for any plan changes.
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function CurrentPlanCard({
  summary,
  onOpenPortal,
  portalDisabled,
  portalBusy,
}: {
  summary: BillingSummary;
  onOpenPortal: () => void;
  portalDisabled: boolean;
  portalBusy: boolean;
}) {
  const copy = planCopy(summary.plan);
  const sub = summary.stripe.subscription;
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{planDisplayName(summary.plan)}</h2>
            {sub && (
              <Badge variant={statusBadgeVariant(sub.status ?? "")} data-testid="subscription-status-badge">
                {sub.status}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{copy.tagline}</p>
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

      {copy.bullets.length > 0 && (
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {copy.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {sub && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
            <p className="font-medium">{formatPrice(sub.unitAmount, sub.currency, sub.cadence)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {sub.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}
            </p>
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
          Your subscription is set to cancel at the end of the current period. Re-activate from the billing portal.
        </div>
      )}
    </Card>
  );
}

function UpgradeCard({
  targets,
  disabled,
  disabledReason,
  onCheckout,
  busy,
}: {
  targets: Plan[];
  disabled: boolean;
  disabledReason: string | null;
  onCheckout: (plan: Plan, cadence: Cadence) => void;
  busy: string | null;
}) {
  return (
    <Card className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">
          {targets.length === 1 ? `Upgrade to ${planDisplayName(targets[0])}` : "Upgrade your plan"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Unlock more pages, custom domains, the Sales Console, and AI features.
        </p>
      </div>
      {disabledReason && (
        <div className="rounded border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {disabledReason}
        </div>
      )}
      <div className="space-y-6">
        {targets.map((plan) => {
          const cfg = PLAN_CONFIG[plan];
          const monthly = cfg.priceMonthly;
          const annualPerMonth = cfg.priceAnnual;
          return (
            <div key={plan} className="space-y-3">
              {targets.length > 1 && (
                <h3 className="text-sm font-semibold">{cfg.displayName}</h3>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <PriceTile
                  label="Monthly"
                  price={monthly != null ? usd(monthly) : "—"}
                  cadence="per month"
                  busy={busy === `checkout-${plan}-monthly`}
                  disabled={disabled || busy !== null || monthly == null}
                  onClick={() => onCheckout(plan, "monthly")}
                  testId={`checkout-${plan}-monthly`}
                />
                <PriceTile
                  label="Annual"
                  price={annualPerMonth != null ? usd(annualPerMonth * 12) : "—"}
                  cadence={
                    annualPerMonth != null
                      ? `per year · ${usd(annualPerMonth)}/mo billed annually`
                      : "billed annually"
                  }
                  busy={busy === `checkout-${plan}-annual`}
                  disabled={disabled || busy !== null || annualPerMonth == null}
                  onClick={() => onCheckout(plan, "annual")}
                  highlighted
                  testId={`checkout-${plan}-annual`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PriceTile({
  label, price, cadence, busy, disabled, onClick, highlighted, testId,
}: {
  label: string; price: string; cadence: string;
  busy: boolean; disabled: boolean;
  onClick: () => void;
  highlighted?: boolean;
  testId: string;
}) {
  return (
    <div className={`rounded-lg border p-5 space-y-3 ${highlighted ? "border-primary bg-primary/5" : "border-border"}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {highlighted && <Badge variant="default" className="text-[10px]">Best value</Badge>}
      </div>
      <div>
        <p className="text-2xl font-semibold">{price}</p>
        <p className="text-xs text-muted-foreground">{cadence}</p>
      </div>
      <Button onClick={onClick} disabled={disabled} className="w-full" data-testid={testId}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        Subscribe
        {!busy && <ArrowRight className="w-4 h-4 ml-1" />}
      </Button>
    </div>
  );
}
