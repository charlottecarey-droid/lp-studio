import { useState } from "react";
import { Link } from "wouter";
import { Lock, Check, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { copyForGate, type GatedFeature } from "@/lib/plan-upgrade";
import { PLAN_CONFIG, type Plan } from "@workspace/plan-config";

interface Props {
  gate: GatedFeature | string;
  /** Server-resolved unlock tier from the 402 contract (optional for static callers). */
  minimumPlanWithFeature?: Plan | null;
  /** Current usage for cap gates (optional). */
  currentUsage?: number | null;
  /** Cap value for cap gates (optional). */
  cap?: number | null;
  /** When true, wraps the prompt in <AppLayout> so it slots into the standard shell. */
  withLayout?: boolean;
}

/**
 * Friendly explainer that replaces the old silent /sales/* redirect for
 * starter tenants. Also used as the body of the upgrade modal/toast so
 * the same copy ships everywhere.
 *
 * Task #425 rewire: when the unlock tier is Growth (the only self-serve
 * tier today), the primary CTA now starts a Stripe Checkout session via
 * `/api/billing/checkout-session` instead of dropping the user into a
 * mailto: link. Enterprise still uses sales@ — it's sales-assisted by
 * design and Checkout has no SKU for it.
 */
export function UpgradePrompt({
  gate,
  minimumPlanWithFeature,
  currentUsage,
  cap,
  withLayout = true,
}: Props) {
  const copy = copyForGate({ gate, minimumPlanWithFeature, currentUsage, cap });
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const unlockTierName = copy.unlockTier
    ? PLAN_CONFIG[copy.unlockTier].displayName
    : "a higher plan";

  async function startCheckout(): Promise<void> {
    if (!copy.unlockTier || !copy.selfServe) return;
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Default to monthly from upgrade prompts; the Billing settings
        // page is where users pick the cadence explicitly. The unlock tier
        // is driven off the server's minimumPlanWithFeature so the right
        // tier (starter / growth / scale) is purchased.
        body: JSON.stringify({ priceLookupKey: `${copy.unlockTier}_monthly` }),
      });
      if (res.status === 503) {
        // Stripe-not-configured fallback: send the operator to the
        // Billing settings page, which renders a useful "billing
        // unavailable" surface explaining what to do.
        window.location.assign("/settings/billing");
        return;
      }
      if (res.status === 403) {
        toast({
          title: "Workspace admin required",
          description: "Ask a workspace admin to upgrade your plan.",
          variant: "destructive",
        });
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
    } finally {
      setBusy(false);
    }
  }

  const isSelfServe = copy.selfServe && !!copy.unlockTier;
  // Non-self-serve splits two ways: enterprise is sales-assisted (mailto),
  // anything else (no tier / free / unknown) routes to the Billing page.
  const isEnterprise = copy.unlockTier === "enterprise";
  const body = (
    <div className="flex items-center justify-center min-h-[70vh] px-4 py-12">
      <Card className="max-w-xl w-full p-8 sm:p-10 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {copy.title}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {copy.subtitle}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5" />
            What you get on {unlockTierName}
          </div>
          <ul className="space-y-2">
            {copy.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {isSelfServe ? (
            <Button
              className="flex-1"
              onClick={startCheckout}
              disabled={busy}
              data-testid="upgrade-prompt-checkout"
            >
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Upgrade to {unlockTierName}
              {!busy && <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>
          ) : isEnterprise ? (
            // Enterprise is sales-assisted. No Stripe SKU for it; the mailto
            // stays.
            <Button asChild className="flex-1">
              <a href="mailto:sales@meetdandy.com?subject=Upgrade%20my%20Landing%20Page%20Studio%20plan">
                Talk to sales
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
          ) : (
            // No purchasable tier resolved (free / unknown). Send the operator
            // to Billing, which renders the full plan picker.
            <Button asChild className="flex-1">
              <Link to="/settings/billing">
                View plans
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="flex-1">
            <Link to={isSelfServe ? "/settings/billing" : "/"}>
              {isSelfServe ? "See pricing" : "Back to workspace"}
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );

  if (!withLayout) return body;
  return <AppLayout>{body}</AppLayout>;
}

export default UpgradePrompt;
