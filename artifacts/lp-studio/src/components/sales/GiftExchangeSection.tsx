import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, HandHeart, Loader2, Plus, Send, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TierId = "premium" | "mid" | "swag";
type Kind = "offer" | "request";
interface Post { id: number; kind: Kind; repEmail: string; repName: string; tier: TierId; qty: number; remaining: number; note: string; createdAt: string; mine: boolean }
interface Balance { tier: TierId; left: number }
interface ToThank { giverEmail: string; giverName: string; gifts: Partial<Record<TierId, number>> }
interface LeaderRow { name: string; pagesSent: number; claimed: number; rate: number; me: boolean }
interface Leaderboard { top: LeaderRow[]; myRank: number | null; mine: LeaderRow | null; ranked: number; minPages: number }
interface ExchangeData { me: string; balances: Balance[]; posts: Post[]; reps?: Array<{ email: string; name: string }>; toThank?: ToThank[]; leaderboard?: Leaderboard }
type FormKind = Kind | "give";

const LABELS: Record<TierId, string> = { premium: "Premium", mid: "Mid-value", swag: "Swag" };

const giftList = (gifts: Partial<Record<TierId, number>>) =>
  (Object.keys(LABELS) as TierId[]).filter((t) => gifts[t]).map((t) => `${gifts[t]} ${LABELS[t]}`).join(" and ");
const pct = (r: number) => `${Math.round(r * 100)}%`;

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
  const [thanking, setThanking] = useState<{ giverEmail: string; message: string } | null>(null);
  const [form, setForm] = useState<{ kind: FormKind; tier: TierId; qty: string; note: string; toEmail: string } | null>(null);

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
    const ok = form.kind === "give"
      ? await call("post", "/api/lp/gifts/exchange/send", { method: "POST", body: JSON.stringify({ toEmail: form.toEmail, tier: form.tier, qty: Number(form.qty), note: form.note }) })
      : await call("post", "/api/lp/gifts/exchange/posts", { method: "POST", body: JSON.stringify({ kind: form.kind, tier: form.tier, qty: Number(form.qty), note: form.note }) });
    if (ok) setForm(null);
  };

  return (
    <div className="space-y-4">
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><ArrowRightLeft className="h-4 w-4" />Up for grabs &amp; requests</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm({ kind: "give", tier: "mid", qty: "1", note: "", toEmail: "" })}><Send className="h-3.5 w-3.5" />Give to a rep</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm({ kind: "offer", tier: "mid", qty: "1", note: "", toEmail: "" })}><HandHeart className="h-3.5 w-3.5" />Put gifts up for grabs</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm({ kind: "request", tier: "mid", qty: "1", note: "", toEmail: "" })}><Plus className="h-3.5 w-3.5" />Request gifts</Button>
        </div>
      </div>

      {(data.toThank ?? []).length > 0 && (
        <div className="mb-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          {(data.toThank ?? []).map((t) => (
            <div key={t.giverEmail} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>🎉 <span className="font-medium">{t.giverName}</span> gave you {giftList(t.gifts)}</span>
              {thanking?.giverEmail === t.giverEmail ? (
                <div className="flex flex-1 items-center gap-2 sm:max-w-md">
                  <Input value={thanking.message} onChange={(e) => setThanking({ ...thanking, message: e.target.value })} maxLength={200} className="h-8 flex-1" autoFocus />
                  <Button size="sm" disabled={busy === "post" || !thanking.message.trim()} onClick={async () => {
                    const ok = await call("post", "/api/lp/gifts/exchange/thanks", { method: "POST", body: JSON.stringify(thanking) });
                    if (ok) setThanking(null);
                  }}>Send</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setThanking({ giverEmail: t.giverEmail, message: "Thank you! 🙏" })}>Say thanks</Button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mb-3 text-xs text-muted-foreground">Have gifts you won't use? Give them to a rep or put them up for grabs. Need more? Ask the other reps here.</p>

      {form && (
        <div className="mb-3 space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="text-xs font-medium">{form.kind === "give" ? "Give gifts from your loot to a rep" : form.kind === "offer" ? "Put gifts from your loot up for grabs" : "Ask other reps for gifts"}</div>
          <div className="flex flex-wrap items-center gap-2">
            {form.kind === "give" && (
              <Select value={form.toEmail} onValueChange={(v) => setForm({ ...form, toEmail: v })}>
                <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Choose a rep" /></SelectTrigger>
                <SelectContent>{(data.reps ?? []).map((r) => <SelectItem key={r.email} value={r.email}>{r.name || r.email}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Input type="number" min={1} max={50} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="h-8 w-20" aria-label="How many" />
            <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v as TierId })}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(LABELS) as TierId[]).map((t) => <SelectItem key={t} value={t}>{LABELS[t]}{form.kind !== "request" ? ` (${left(t)} left)` : ""}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (optional), e.g. which account" className="h-8 min-w-[12rem] flex-1" maxLength={280} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy === "post" || (form.kind === "give" && !form.toEmail)} className="gap-1.5">{busy === "post" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{form.kind === "give" ? "Give" : "Post"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setForm(null); setError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {error && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>}

      {data.posts.length === 0 ? (
        <p className="text-xs text-muted-foreground">The pile's empty. Got gifts you won't use? Drop them here. Need more? Start a hunt.</p>
      ) : (
        <ul className="divide-y">
          {data.posts.map((p) => {
            const who = p.mine ? "You" : p.repName || p.repEmail;
            const what = `${p.qty} ${LABELS[p.tier]}`;
            const cantGive = p.kind === "request" && !p.mine && left(p.tier) < 1;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 text-sm">
                  {p.kind === "offer"
                    ? <>🎁 <span className="font-medium">{who}</span> dropped <span className="font-medium">{what}</span> in the pile</>
                    : <>🎯 <span className="font-medium">{who}</span> {p.mine ? "are" : "is"} hunting for <span className="font-medium">{what}</span></>}
                  {p.remaining < p.qty && <span className="text-muted-foreground"> · {p.remaining} {p.kind === "offer" ? "left" : "still needed"}</span>}
                  <div className="text-xs text-muted-foreground">{p.note ? `“${p.note}” · ` : ""}{ago(p.createdAt)}</div>
                </div>
                {p.mine ? (
                  <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => call(p.id, `/api/lp/gifts/exchange/posts/${p.id}`, { method: "DELETE" })}>Remove</Button>
                ) : (
                  <Button size="sm" variant={p.kind === "offer" ? "default" : "outline"} disabled={busy === p.id || cantGive} title={cantGive ? `You have no ${LABELS[p.tier]} gifts left to give` : undefined}
                    onClick={() => call(p.id, `/api/lp/gifts/exchange/posts/${p.id}/act`, { method: "POST" })} className="gap-1.5">
                    {busy === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {p.kind === "offer" ? "Claim 1" : "Give 1"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">You're trading as {data.me}. Claim 1 and Give 1 on a post each move one gift.</p>
    </Card>
    {data.leaderboard && <ClaimLeaderboard board={data.leaderboard} />}
    </div>
  );
}

/** Reps ranked by the share of their gift pages that recipients have claimed. */
function ClaimLeaderboard({ board }: { board: Leaderboard }) {
  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4" />Claim leaderboard</div>
      <p className="mb-3 text-xs text-muted-foreground">Share of each rep's gift pages that recipients have claimed. You're on the board once you've sent {board.minPages} pages.</p>
      {board.top.length === 0 ? (
        <p className="text-xs text-muted-foreground">No one's on the board yet.</p>
      ) : (
        <ol className="space-y-1">
          {board.top.map((r, i) => (
            <li key={`${r.name}-${i}`} className={cn("flex items-center gap-3 rounded-md px-2 py-1.5 text-sm", r.me && "bg-muted font-medium")}>
              <span className="w-6 text-center tabular-nums">{medal(i)}</span>
              <span className="min-w-0 flex-1 truncate">{r.me ? `${r.name} (you)` : r.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{r.claimed} of {r.pagesSent} claimed</span>
              <span className="w-12 text-right font-semibold tabular-nums">{pct(r.rate)}</span>
            </li>
          ))}
        </ol>
      )}
      {board.mine && board.myRank && board.myRank > board.top.length && (
        <p className="mt-2 text-xs text-muted-foreground">You're #{board.myRank} of {board.ranked} at {pct(board.mine.rate)} ({board.mine.claimed} of {board.mine.pagesSent} claimed).</p>
      )}
      {!board.mine && <p className="mt-2 text-xs text-muted-foreground">Send {board.minPages} gift pages to get on the board.</p>}
    </Card>
  );
}
