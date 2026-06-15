import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Megaphone, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const ENDPOINT = `${BASE}/api/admin/lp/announcement-banner`;

interface BannerData {
  enabled: boolean;
  text: string;
  linkUrl: string;
  ctaLabel: string;
}

const EMPTY: BannerData = { enabled: false, text: "", linkUrl: "", ctaLabel: "" };

function normalize(data: unknown): BannerData {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    enabled: d.enabled === true,
    text: typeof d.text === "string" ? d.text : "",
    linkUrl: typeof d.linkUrl === "string" ? d.linkUrl : "",
    ctaLabel: typeof d.ctaLabel === "string" ? d.ctaLabel : "",
  };
}

/**
 * Superadmin panel for the slim announcement bar shown at the top of the
 * marketing homepage (lpstudio.ai/). Toggle it on/off, edit the message, the
 * link it points to, and the call-to-action label. The bar only appears on the
 * live site when it's turned on AND has both a message and a link. Edits reach
 * the live site immediately; they reach non-JS scrapers on the next publish.
 */
export default function SuperAdminAnnouncementBanner() {
  const { toast } = useToast();
  const [banner, setBanner] = useState<BannerData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(ENDPOINT, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      setBanner(normalize(await res.json()));
    } catch {
      /* best-effort — panel starts empty; auth errors surface via the page guard */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled: banner.enabled,
          text: banner.text,
          linkUrl: banner.linkUrl,
          ctaLabel: banner.ctaLabel,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      setBanner(normalize(await res.json()));
      toast({
        title: "Announcement banner saved",
        description: "The marketing homepage will use this right away. It reaches social scrapers on the next publish.",
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const liveOnSite = banner.enabled && !!banner.text.trim() && !!banner.linkUrl.trim();

  return (
    <Card className="p-6 flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-lg">Homepage announcement banner</h2>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        A slim, dismissible bar at the very top of the marketing homepage
        (<code className="px-1 rounded bg-muted">lpstudio.ai</code>). It only shows on the live site when it's
        turned on and has both a message and a link.
      </p>
      <Separator />

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={banner.enabled}
          onChange={(e) => setBanner((b) => ({ ...b, enabled: e.target.checked }))}
          className="w-4 h-4 accent-[var(--primary)]"
        />
        <span className="text-sm font-medium">Show the banner on the homepage</span>
      </label>

      <div>
        <Label className="text-sm font-medium mb-1.5 block">Message</Label>
        <Input
          value={banner.text}
          onChange={(e) => setBanner((b) => ({ ...b, text: e.target.value }))}
          placeholder="e.g. New — The Ultimate Guide to AI Landing Page Personalization"
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-1.5 block">Link URL</Label>
        <Input
          value={banner.linkUrl}
          onChange={(e) => setBanner((b) => ({ ...b, linkUrl: e.target.value }))}
          placeholder="https://…"
        />
        <p className="text-[11px] text-muted-foreground mt-1">Where the banner sends visitors when they click it.</p>
      </div>

      <div>
        <Label className="text-sm font-medium mb-1.5 block">Call-to-action label</Label>
        <Input
          value={banner.ctaLabel}
          onChange={(e) => setBanner((b) => ({ ...b, ctaLabel: e.target.value }))}
          placeholder="e.g. Read the guide"
        />
        <p className="text-[11px] text-muted-foreground mt-1">The clickable bit at the end of the message (optional).</p>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Preview</Label>
        {banner.text.trim() || banner.linkUrl.trim() ? (
          <div
            className="rounded-md px-6 py-2.5 flex items-center justify-center gap-2 text-center"
            style={{ background: "#1A1815", color: "#F6F2E9" }}
          >
            <span className="text-[13px]" style={{ opacity: 0.92 }}>
              {banner.text.trim() || "Your message"}
            </span>
            {banner.ctaLabel.trim() ? (
              <span
                className="text-[13px] font-medium inline-flex items-center gap-1"
                style={{ borderBottom: "1px solid rgba(246,242,233,0.5)" }}
              >
                {banner.ctaLabel.trim()} <span aria-hidden="true">→</span>
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Add a message to see a preview.</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          {liveOnSite
            ? "This banner is live on the homepage."
            : banner.enabled
              ? "Turned on, but it needs both a message and a link before it shows."
              : "Turned off — nothing shows on the homepage."}
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save banner"}
        </Button>
      </div>
    </Card>
  );
}
