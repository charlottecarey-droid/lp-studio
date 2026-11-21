import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VanityLinkRow { slug: string; targetUrl: string }

/**
 * Self-contained card for the per-tenant microsite root redirect and
 * vanity-link map. These settings live in tenants.settings JSONB and are
 * read/written via /api/admin/tenant-settings — they're independent of
 * BrandConfig, so this card manages its own fetch/save lifecycle rather
 * than piggy-backing on any parent page's save bar.
 */
export function MicrositeLinksCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rootRedirectUrl, setRootRedirectUrl] = useState<string>("");
  const [rootPageSlug, setRootPageSlug] = useState<string>("");
  const [links, setLinks] = useState<VanityLinkRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/admin/tenant-settings");
        if (!r.ok) return;
        const data = await r.json() as {
          rootRedirectUrl?: string | null;
          rootPageSlug?: string | null;
          vanityLinks?: VanityLinkRow[];
        };
        if (cancelled) return;
        setRootRedirectUrl(data.rootRedirectUrl ?? "");
        setRootPageSlug(data.rootPageSlug ?? "");
        setLinks(Array.isArray(data.vanityLinks) ? data.vanityLinks : []);
      } catch {
        // best-effort — leave inputs empty so the user can still configure
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateLink = (idx: number, changes: Partial<VanityLinkRow>) => {
    setLinks(prev => prev.map((l, i) => i === idx ? { ...l, ...changes } : l));
  };
  const removeLink = (idx: number) => {
    setLinks(prev => prev.filter((_, i) => i !== idx));
  };
  const addLink = () => {
    setLinks(prev => [...prev, { slug: "", targetUrl: "" }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmed = links.map(l => ({
        slug: l.slug.trim().toLowerCase(),
        targetUrl: l.targetUrl.trim(),
      }));
      const halfFilled = trimmed.find(l =>
        (l.slug.length > 0) !== (l.targetUrl.length > 0)
      );
      if (halfFilled) {
        toast({
          title: "Finish your vanity links",
          description: halfFilled.slug
            ? `Add a target URL for "/${halfFilled.slug}" or remove the row.`
            : `Add a slug for "${halfFilled.targetUrl}" or remove the row.`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      const cleaned = trimmed.filter(l => l.slug.length > 0 && l.targetUrl.length > 0);
      const r = await fetch("/api/admin/tenant-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootRedirectUrl: rootRedirectUrl.trim() || null,
          rootPageSlug: rootPageSlug.trim().replace(/^\/+/, "") || null,
          vanityLinks: cleaned,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast({
          title: "Couldn't save",
          description: err?.error ?? `HTTP ${r.status}`,
          variant: "destructive",
        });
        return;
      }
      const data = await r.json() as {
        rootRedirectUrl?: string | null;
        rootPageSlug?: string | null;
        vanityLinks?: VanityLinkRow[];
      };
      setRootRedirectUrl(data.rootRedirectUrl ?? "");
      setRootPageSlug(data.rootPageSlug ?? "");
      setLinks(Array.isArray(data.vanityLinks) ? data.vanityLinks : []);
      toast({ title: "Saved" });
    } catch (err) {
      toast({
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Network error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-semibold">Home page and vanity links</h3>

      <div className="space-y-1.5">
        <Label className="text-sm">Home page</Label>
        <Input
          value={rootPageSlug}
          onChange={e => setRootPageSlug(e.target.value)}
          placeholder="e.g. home"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          The slug of the page to show at your domain's root.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Or send the root to another site</Label>
        <Input
          value={rootRedirectUrl}
          onChange={e => setRootRedirectUrl(e.target.value)}
          placeholder="e.g. https://www.yourcompany.com"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">Used only when no home page is set.</p>
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm">Vanity links</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              A short path on your domain that redirects anywhere.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addLink} disabled={loading} className="gap-1 shrink-0">
            + Add link
          </Button>
        </div>
        {links.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">None yet.</p>
        ) : (
          <div className="space-y-2">
            {links.map((link, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground font-mono shrink-0">/</span>
                  <Input
                    value={link.slug}
                    onChange={e => updateLink(idx, { slug: e.target.value })}
                    placeholder="slug"
                    className="font-mono text-sm"
                  />
                </div>
                <span className="text-xs text-muted-foreground pt-2 shrink-0">→</span>
                <Input
                  value={link.targetUrl}
                  onChange={e => updateLink(idx, { targetUrl: e.target.value })}
                  placeholder="https://…"
                  className="flex-[2] text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLink(idx)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remove vanity link"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving || loading} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </Card>
  );
}
