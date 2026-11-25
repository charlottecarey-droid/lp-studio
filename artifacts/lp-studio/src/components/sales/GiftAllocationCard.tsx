import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TierId = "premium" | "mid" | "swag";
interface TierRow { tier: TierId; allocated: number; redeemed: number; received: number; given: number; left: number }
export interface GiftAllocation {
  email: string;
  configured: boolean;
  linksSent: number;
  allocated?: boolean;
  name?: string;
  tiers?: TierRow[];
}

const LABELS: Record<TierId, string> = { premium: "Premium", mid: "Mid-value", swag: "Swag" };

/**
 * The signed-in rep's holiday gift allocation, read from the gifting sheet's
 * Allocations tab plus rep-to-rep transfers (GET /lp/gifts/my-allocation).
 * "Left" counts down as their recipients claim gifts, not as links go out, so
 * reps can send more links than they have gifts. Renders nothing until an allocation sheet is set up.
 */
export function GiftAllocationCard({ version = 0 }: { version?: number }) {
  const [data, setData] = useState<GiftAllocation | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lp/gifts/my-allocation")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GiftAllocation | null) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [version]);

  if (!data || !data.configured) return null;

  if (!data.allocated) {
    return (
      <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
        <Gift className="h-4 w-4 shrink-0" />
        <span>You ({data.email}) don't have a gift allocation yet. Ask marketing to add you to the gifting sheet.</span>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="h-4 w-4" />
          Your loot
        </div>
        <div className="text-xs text-muted-foreground">{data.linksSent} gift page{data.linksSent === 1 ? "" : "s"} sent</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(data.tiers ?? []).map((t) => (
          <div key={t.tier} className="rounded-lg border p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{LABELS[t.tier]}</div>
            <div className={cn("mt-1 text-2xl font-semibold tabular-nums", t.left <= 0 && "text-muted-foreground")}>
              {Math.max(t.left, 0)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">left</span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t.allocated} allocated · {t.redeemed} claimed
              {t.received ? ` · +${t.received} received` : ""}
              {t.given ? ` · −${t.given} given` : ""}
              {t.left < 0 ? ` · ${-t.left} over` : ""}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        A gift only counts once your recipient claims it, so you can send more links than you have gifts left.
      </p>
    </Card>
  );
}
