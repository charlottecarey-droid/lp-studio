import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, HandHeart, Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TierId = "premium" | "mid" | "swag";
type Kind = "offer" | "request";
interface Post { id: number; kind: Kind; repEmail: string; repName: string; tier: TierId; qty: number; remaining: number; note: string; createdAt: string; mine: boolean }
interface Balance { tier: TierId; left: number }
interface ExchangeData { me: string; balances: Balance[]; posts: Post[] }

const LABELS: Record<TierId, string> = { premium: "Premium", mid: "Mid-value", swag: "Swag" };

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

/**
 * "Up for grabs & requests" on the Sales Console gifting page. Reps put gifts
 * from their loot up for grabs or ask for gifts; each Claim / Give moves ONE
 * gift and the post counts down. Always acts as the signed-in rep. Calls
 * `onChange` after any move so the loot card refreshes.
 */
export function GiftExchangeSection({ onChange }: { onChange?: () => void }) {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | "post" | null>(null);
  const [form, setForm] = useState<{ kind: Kind; tier: TierId; qty: string; note: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/lp/gifts/exchange")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ExchangeData | null) => setData(d))
      .catch(() => setData(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (key: number | "post", url: string, init: RequestInit) => {
    setBusy(key); setError(null);
    try {
      const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body?.error || "That didn't work. Try again."); return false; }
      return true;
    } catch {
      setError("That didn't work. Try again."); return false;
    } finally {
      setBusy(null); load(); onChange?.();
    }
  };

  if (!data) return null;
  const left = (tier: TierId) => data.balances.find((b) => b.tier === tier)?.left ?? 0;

  const submit = async () => {
    if (!form) return;
    const ok = await call("post", "/api/lp/gifts/exchange/posts", { method: "POST", body: JSON.stringify({ kind: form.kind, tier: form.tier, qty: Number(form.qty), note: form.note }) });
    if (ok) setForm(null);
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><ArrowRightLeft className="h-4 w-4" />Up for grabs &amp; requests</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm({ kind: "offer", tier: "mid", qty: "1", note: "" })}><HandHeart className="h-3.5 w-3.5" />Put gifts up for grabs</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm({ kind: "request", tier: "mid", qty: "1", note: "" })}><Plus className="h-3.5 w-3.5" />Request gifts</Button>
        </div>
      </div>

      {form && (
        <div className="mb-3 space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="text-xs font-medium">{form.kind === "offer" ? "Put gifts from your loot up for grabs" : "Ask other reps for gifts"}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="number" min={1} max={50} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="h-8 w-20" aria-label="How many" />
            <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v as TierId })}>
              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(LABELS) as TierId[]).map((t) => <SelectItem key={t} value={t}>{LABELS[t]}{form.kind === "offer" ? ` (${left(t)} left)` : ""}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (optional), e.g. which account" className="h-8 min-w-[12rem] flex-1" maxLength={280} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy === "post"} className="gap-1.5">{busy === "post" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Post</Button>
            <Button size="sm" variant="ghost" onClick={() => { setForm(null); setError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {error && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>}

      {data.posts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing here yet. Have gifts you won't use, or need a few more? Post them here.</p>
      ) : (
        <ul className="divide-y">
          {data.posts.map((p) => {
            const who = p.mine ? "You" : p.repName || p.repEmail;
            const what = `${p.remaining} ${LABELS[p.tier]}`;
            const cantGive = p.kind === "request" && !p.mine && left(p.tier) < 1;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{who}</span>{" "}
                  {p.kind === "offer" ? <>{p.mine ? "have" : "has"} <span className="font-medium">{what}</span> up for grabs</> : <>{p.mine ? "need" : "needs"} <span className="font-medium">{what}</span></>}
                  {p.remaining < p.qty && <span className="text-muted-foreground"> (of {p.qty})</span>}
                  <div className="text-xs text-muted-foreground">{p.note ? `“${p.note}” · ` : ""}{ago(p.createdAt)}</div>
                </div>
                {p.mine ? (
                  <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => call(p.id, `/api/lp/gifts/exchange/posts/${p.id}`, { method: "DELETE" })}>Remove</Button>
                ) : (
                  <Button size="sm" variant={p.kind === "offer" ? "default" : "outline"} disabled={busy === p.id || cantGive} title={cantGive ? `You have no ${LABELS[p.tier]} gifts left to give` : undefined}
                    onClick={() => call(p.id, `/api/lp/gifts/exchange/posts/${p.id}/act`, { method: "POST" })} className="gap-1.5">
                    {busy === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {p.kind === "offer" ? "Claim 1" : "Give 1 from my loot"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">You're trading as {data.me}. Each click moves one gift.</p>
    </Card>
  );
}
