import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Eye, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type SiteWithViews = {
  id: string;
  slug: string;
  skin: string;
  created_at: string;
  viewCount: number;
};

export default function AccountExperiences({ companyName, sfdcId }: { companyName: string; sfdcId?: string | null }) {
  const [sites, setSites] = useState<SiteWithViews[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!companyName) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      let microsites: any[] | null = null;
      if (sfdcId) {
        const { data } = await supabase
          .from("microsites")
          .select("id, slug, skin, created_at")
          .eq("salesforce_id", sfdcId)
          .order("created_at", { ascending: false });
        microsites = data;
      }
      if (!microsites?.length) {
        const { data } = await supabase
          .from("microsites")
          .select("id, slug, skin, created_at")
          .ilike("company_name", companyName)
          .order("created_at", { ascending: false });
        microsites = data;
      }

      if (!microsites?.length) { setSites([]); setLoading(false); return; }

      // Get view counts
      const ids = microsites.map(m => m.id);
      const { data: views } = await supabase
        .from("microsite_views")
        .select("microsite_id")
        .in("microsite_id", ids);

      const viewCounts: Record<string, number> = {};
      for (const v of views || []) {
        viewCounts[v.microsite_id] = (viewCounts[v.microsite_id] || 0) + 1;
      }

      if (!cancelled) {
        setSites(microsites.map(m => ({
          ...m,
          viewCount: viewCounts[m.id] || 0,
        })));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [companyName, sfdcId]);

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/dso/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast.success("Link copied");
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Active Experiences</h3>
        </div>
        <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Active Experiences
        </h3>
        {sites.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
            {sites.length}
          </span>
        )}
      </div>

      {sites.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No microsites created yet</p>
      ) : (
        <div className="space-y-2">
          {sites.map((site) => (
            <div key={site.id} className="flex items-center gap-3 rounded-lg bg-secondary/30 border border-border px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{site.slug}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium capitalize">{site.skin}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {site.viewCount}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(site.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`/dso/${site.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  title="Open"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => copyLink(site.slug)}
                  className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  title="Copy link"
                >
                  {copiedSlug === site.slug ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
