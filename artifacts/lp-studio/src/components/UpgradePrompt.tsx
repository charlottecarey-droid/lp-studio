import { useState } from "react";
import { Link } from "wouter";
import { Lock, Check, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { copyForFeature, type GatedFeature } from "@/lib/plan-upgrade";

interface Props {
  feature: GatedFeature | string;
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
export function UpgradePrompt({ feature, withLayout = true }: Props) {
  const copy = copyForFeature(feature);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function startGrowthCheckout(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Default to monthly from upgrade prompts; the Billing settings
        // page is where users pick the cadence explicitly.
        body: JSON.stringify({ priceLookupKey: "growth_monthly" }),
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

  const isGrowth = copy.unlockTier === "growth";
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
            What you get on {isGrowth ? "Growth" : "Enterprise"}
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
          {isGrowth ? (
            <Button
              className="flex-1"
              onClick={startGrowthCheckout}
              disabled={busy}
              data-testid="upgrade-prompt-checkout"
            >
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Upgrade to Growth
              {!busy && <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>
          ) : (
            // Enterprise is sales-assisted. No Stripe price for it; the
            // mailto stays.
            <Button asChild className="flex-1">
              <a href="mailto:sales@meetdandy.com?subject=Upgrade%20my%20Landing%20Page%20Studio%20plan">
                Talk to sales
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
          )}
          <Button asChild variant="outline" className="flex-1">
            <Link to={isGrowth ? "/settings/billing" : "/"}>
              {isGrowth ? "See pricing" : "Back to workspace"}
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
