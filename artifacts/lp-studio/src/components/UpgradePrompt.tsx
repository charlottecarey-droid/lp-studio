import { Link } from "wouter";
import { Lock, Check, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";
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
 */
export function UpgradePrompt({ feature, withLayout = true }: Props) {
  const copy = copyForFeature(feature);
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
            What you get on {copy.unlockTier === "growth" ? "Growth" : "Enterprise"}
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
          <Button asChild className="flex-1">
            <a href="mailto:sales@meetdandy.com?subject=Upgrade%20my%20Landing%20Page%20Studio%20plan">
              Talk to sales
              <ArrowRight className="w-4 h-4 ml-1" />
            </a>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/">Back to workspace</Link>
          </Button>
        </div>
      </Card>
    </div>
  );

  if (!withLayout) return body;
  return <AppLayout>{body}</AppLayout>;
}

export default UpgradePrompt;
