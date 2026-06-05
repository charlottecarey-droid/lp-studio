import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload, Share2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  OgCharCount,
  OgDimensionWarning,
  ShareCardPreview,
  useImageDimensions,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
} from "@/components/og-share-card";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// The marketing homepage always renders at the apex domain — the share preview
// and any OG image are scoped to lpstudio.ai.
const MARKETING_DOMAIN = "lpstudio.ai";

interface HomepageOg {
  title: string;
  description: string;
  imageUrl: string;
}

/**
 * Superadmin panel that brings the same share-card editing affordances the
 * tenant landing pages have (live preview, char-count guidance, 1200×630
 * dimension warning + one-click resize) to the MARKETING homepage
 * (lpstudio.ai/). Reads/writes the single `marketing_homepage_og` config row
 * via /api/lp/homepage-og (public read) and /api/admin/lp/homepage-og (admin).
 */
export default function SuperAdminMarketingShareCard() {
  const { toast } = useToast();
  const [og, setOg] = useState<HomepageOg>({ title: "", description: "", imageUrl: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track the served image's real pixel size so we can persist it alongside the
  // URL (the OgDimensionWarning resize lands a 1200×630 image; a pasted URL may
  // be anything). Saving the dimensions lets future reads warn without a fetch.
  const { width: imgWidth, height: imgHeight } = useImageDimensions(og.imageUrl);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/lp/homepage-og`, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setOg({
        title: typeof data.title === "string" ? data.title : "",
        description: typeof data.description === "string" ? data.description : "",
        imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : "",
      });
    } catch {
      /* best-effort — panel starts empty; session auth errors surface via the page guard */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilePick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!file) return;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/lp/upload", { method: "POST", body: formData, credentials: "include" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Upload failed");
        }
        const data = await res.json();
        setOg((prev) => ({ ...prev, imageUrl: `/api/storage${data.url}` }));
        toast({ title: "Share image uploaded", description: "Click Save share card to apply it." });
      } catch (err) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [toast],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/admin/lp/homepage-og`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: og.title,
          description: og.description,
          imageUrl: og.imageUrl,
          imageWidth: imgWidth ?? null,
          imageHeight: imgHeight ?? null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      const data = await res.json();
      setOg({
        title: typeof data.title === "string" ? data.title : "",
        description: typeof data.description === "string" ? data.description : "",
        imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : "",
      });
      toast({
        title: "Homepage share card saved",
        description: "The marketing homepage will use this when its link is shared. Edits reach social scrapers on the next publish.",
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

  return (
    <Card className="p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-lg">Homepage share card</h2>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Shown when the marketing homepage (<code className="px-1 rounded bg-muted">{MARKETING_DOMAIN}</code>) link is
        shared on social media or messaging apps. Leave a field blank to fall back to the built-in default.
      </p>
      <Separator />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Title</Label>
            <Input
              value={og.title}
              onChange={(e) => setOg((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. LP Studio — The AI Revenue Workspace for One-Team GTM"
            />
            <OgCharCount value={og.title} kind="title" />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Description</Label>
            <textarea
              value={og.description}
              onChange={(e) => setOg((p) => ({ ...p, description: e.target.value }))}
              placeholder="Briefly describe the homepage for link previews…"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background resize-none outline-none focus:ring-1 focus:ring-ring"
            />
            <OgCharCount value={og.description} kind="description" />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFilePick}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-1.5 shrink-0"
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /> Upload image</>
                )}
              </Button>
              {og.imageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOg((p) => ({ ...p, imageUrl: "" }))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="mt-3">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 block">…or paste a URL</Label>
              <Input
                value={og.imageUrl}
                onChange={(e) => setOg((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="https://… or /api/storage/…"
              />
            </div>
            <OgDimensionWarning
              imageUrl={og.imageUrl}
              onResized={(url) => setOg((p) => ({ ...p, imageUrl: url }))}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium">Share preview</Label>
          <ShareCardPreview
            title={og.title}
            description={og.description}
            imageUrl={og.imageUrl}
            domain={MARKETING_DOMAIN}
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[240px]">
            Best at {OG_IMAGE_WIDTH}×{OG_IMAGE_HEIGHT}px.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save share card"}
        </Button>
      </div>
    </Card>
  );
}
