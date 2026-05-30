import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TenantSeoPayload {
  seoAllowIndexing: boolean;
  seoAllowFollowing: boolean;
}

function SeoContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingIndexing, setSavingIndexing] = useState(false);
  const [savingFollowing, setSavingFollowing] = useState(false);
  const [allowIndexing, setAllowIndexing] = useState(true);
  const [allowFollowing, setAllowFollowing] = useState(true);

  const isAdmin = user?.isAdmin ?? false;
  const canManage = isAdmin || !!user?.permissions?.["settings"];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenant-settings", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TenantSeoPayload;
      setAllowIndexing(json.seoAllowIndexing);
      setAllowFollowing(json.seoAllowFollowing);
    } catch {
      toast({ title: "Failed to load SEO settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // Each axis patches independently; the server always persists BOTH axes
  // together (the settings.seo object is replaced wholesale on a shallow
  // JSONB merge), reading the unspecified one from the current row.
  async function patchAxis(field: "seoAllowIndexing" | "seoAllowFollowing", next: boolean) {
    if (!canManage) return;
    const setSaving = field === "seoAllowIndexing" ? setSavingIndexing : setSavingFollowing;
    const setLocal = field === "seoAllowIndexing" ? setAllowIndexing : setAllowFollowing;
    setLocal(next);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tenant-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      const json = (await res.json()) as TenantSeoPayload & { error?: string };
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setAllowIndexing(json.seoAllowIndexing);
      setAllowFollowing(json.seoAllowFollowing);
      toast({ title: "SEO settings updated" });
    } catch (err) {
      setLocal(!next);
      toast({
        title: "Failed to update SEO settings",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SEO &amp; discoverability</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Workspace defaults for whether search engines and AI crawlers can
          index your published pages. Individual pages can override these from
          the page&rsquo;s Settings tab.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Search className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold">Allow search engine indexing</h2>
                    <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                      When ON, published pages can appear in Google, Bing, and
                      AI search results. When OFF, pages carry a
                      <span className="font-mono"> noindex</span> directive so
                      they stay out of search — useful for private 1:1
                      prospect pages.
                    </p>
                  </div>
                  <Switch
                    checked={allowIndexing}
                    onCheckedChange={(v) => patchAxis("seoAllowIndexing", v)}
                    disabled={!canManage || savingIndexing}
                    data-testid="seo-indexing-toggle"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Search className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold">Allow link following</h2>
                    <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                      When ON, crawlers may follow links on your pages. When
                      OFF, pages carry a
                      <span className="font-mono"> nofollow</span> directive so
                      crawlers don&rsquo;t pass authority through outbound
                      links.
                    </p>
                  </div>
                  <Switch
                    checked={allowFollowing}
                    onCheckedChange={(v) => patchAxis("seoAllowFollowing", v)}
                    disabled={!canManage || savingFollowing}
                    data-testid="seo-following-toggle"
                  />
                </div>
              </div>
            </div>
          </Card>

          {!canManage && (
            <p className="text-[11px] text-muted-foreground italic">
              Only workspace admins can change these settings.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function SeoPage() {
  const [location] = useLocation();
  const Layout = location.startsWith("/sales") ? SalesLayout : AppLayout;
  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <SeoContent />
      </div>
    </Layout>
  );
}
