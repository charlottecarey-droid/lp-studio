import { useEffect, useState } from "react";
import { Gift, Loader2, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface GiftingDigestSettings { enabled: boolean; channelId: string; hour: number; lastSentAt?: string }

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"} CT`;

/**
 * Holiday gifting daily summary: a weekday Slack post (claims, gift pages, the
 * pile, leaderboards, gifts running low) to its own channel. The channel can be
 * a Slack Connect channel shared from another workspace, as long as the LP
 * Studio app has been added to it.
 */
export function GiftingDigestCard({ initial, onBanner }: { initial?: GiftingDigestSettings; onBanner: (b: { ok: boolean; message: string }) => void }) {
  const [cfg, setCfg] = useState<GiftingDigestSettings>(initial ?? { enabled: false, channelId: "", hour: 9 });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => { if (initial) setCfg(initial); }, [initial?.enabled, initial?.channelId, initial?.hour]);

  const save = async (next: GiftingDigestSettings) => {
    setSaving(true);
    try {
      const res = await fetch("/api/sales/slack/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftingDigest: { enabled: next.enabled, channelId: next.channelId.trim(), hour: next.hour } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { onBanner({ ok: false, message: body?.error || "Couldn't save the gifting summary settings." }); return false; }
      setCfg({ ...next, channelId: next.channelId.trim() });
      onBanner({ ok: true, message: next.enabled ? `Gifting summary on: weekdays at ${hourLabel(next.hour)}.` : "Gifting summary saved (off)." });
      return true;
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/sales/slack/gifting-digest/send", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      onBanner(res.ok ? { ok: true, message: "Sent today's gifting summary. Check the channel." } : { ok: false, message: body?.error || "Couldn't send the summary." });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Gift className="h-4 w-4" />Holiday gifting daily summary</h2>
        <Switch checked={cfg.enabled} disabled={saving || !cfg.channelId.trim()} onCheckedChange={(v) => save({ ...cfg, enabled: v })} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Weekday post with gifts claimed, new gift pages, what's up for grabs, both leaderboards and gifts running low. Quiet days are skipped.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium">Channel ID</span>
          <Input value={cfg.channelId} onChange={(e) => setCfg({ ...cfg, channelId: e.target.value })} placeholder="C0CLLP00TRV" className="h-9 w-48 font-mono" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium">Time</span>
          <Select value={String(cfg.hour)} onValueChange={(v) => setCfg({ ...cfg, hour: Number(v) })}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <Button size="sm" onClick={() => save(cfg)} disabled={saving || !cfg.channelId.trim()} className="gap-1.5">{saving && <Loader2 className="h-3 w-3 animate-spin" />}Save</Button>
        <Button size="sm" variant="outline" onClick={sendNow} disabled={sending || !cfg.channelId.trim()} className="gap-1.5">
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}Send now
        </Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Find the ID in Slack under the channel's name → About (bottom). The LP Studio app must be in the channel: type <span className="font-mono">/invite @LP Studio</span> there. A channel shared from another workspace (Slack Connect) works too.
        {cfg.lastSentAt ? ` Last sent ${new Date(cfg.lastSentAt).toLocaleString()}.` : ""}
      </p>
    </Card>
  );
}
