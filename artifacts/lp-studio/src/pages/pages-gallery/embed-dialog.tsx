import { useState } from "react";
import { Check, Code2, Copy, Link2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { API_BASE, type Page } from "./types";

/* The stored token on the host site is keyed by param name, so every slot
   sharing a param follows the same link and slots with different params are
   independent. Remembering the last-used param per page keeps the snippet
   and every link minted for it on the same key. */
const PARAM_STORAGE_PREFIX = "lpStudio.embedParam.";
const DEFAULT_PARAM = "lp_page";

export function EmbedDialog({ page, onClose }: { page: Page; onClose: () => void }) {
  const { domainContext, user } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;
  const tenantHost = user?.tenantHost ?? null;
  /* Same host-resolution order as getLpPageUrl: the loader must be served
     from the host that owns the slug, or the embed redirect resolves the
     wrong tenant. */
  const embedOrigin = micrositeDomain
    ? `https://${micrositeDomain}`
    : tenantHost ? `https://${tenantHost}` : window.location.origin;

  const [param, setParam] = useState<string>(() => {
    try { return window.localStorage.getItem(PARAM_STORAGE_PREFIX + page.id) || DEFAULT_PARAM; } catch { return DEFAULT_PARAM; }
  });
  const paramOk = /^[A-Za-z0-9_-]{1,64}$/.test(param);
  const [copied, setCopied] = useState<"snippet" | "link" | null>(null);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPublished = page.status === "published";

  const snippet =
    `<div id="lp-page"></div>\n` +
    `<script async src="${embedOrigin}/api/embed/page.js" data-param="${param}" data-page="${page.slug}"></script>`;

  const rememberParam = () => {
    try { window.localStorage.setItem(PARAM_STORAGE_PREFIX + page.id, param); } catch {}
  };

  const flashCopied = (which: "snippet" | "link") => {
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  const copySnippet = () => {
    rememberParam();
    navigator.clipboard.writeText(snippet).then(() => flashCopied("snippet"));
  };

  const copyLink = () => {
    setMinting(true);
    setError(null);
    rememberParam();
    /* Token is minted on first copy: most pages are never embedded, and it
       only exists to go in a link. Published-only, enforced server-side too. */
    fetch(`${API_BASE}/lp/pages/${page.id}/embed-token`, { method: "POST" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Couldn't create the link");
        await navigator.clipboard.writeText(`?${param}=${data.embedToken}`);
        flashCopied("link");
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setMinting(false));
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-muted-foreground" />
            Embed on a website
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!isPublished && (
            <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
              Publish this page first — embeds only render published pages.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            The snippet renders this page inside another website. A link ending in the
            personalized suffix makes that visitor's slot show a different page — every
            slot on the site using the same link param follows the same link, so give
            independent slots different param names.
          </p>
          <div>
            <Label className="text-sm font-medium">Link param</Label>
            <Input
              className="mt-1.5 font-mono text-[13px]"
              value={param}
              onChange={e => setParam(e.target.value.trim())}
              placeholder={DEFAULT_PARAM}
            />
            {!paramOk && (
              <p className="text-xs text-red-500 mt-1">Letters, numbers, dashes and underscores only.</p>
            )}
          </div>
          <div>
            <Label className="text-sm font-medium">Snippet <span className="text-muted-foreground font-normal">— paste where the content should appear</span></Label>
            <pre className="mt-1.5 text-[11px] font-mono bg-muted rounded-md px-3 py-2 whitespace-pre-wrap break-all border border-border">{snippet}</pre>
            <p className="text-[11px] text-muted-foreground mt-1">
              <code>data-page</code> is what visitors without a link see — remove it to leave the
              host's own section in place instead. Add <code>data-mode="page"</code> for a
              full-height whole-page embed.
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex items-center gap-2">
            <Button onClick={copySnippet} disabled={!paramOk || !isPublished} variant="outline" className="gap-2">
              {copied === "snippet" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === "snippet" ? "Copied" : "Copy snippet"}
            </Button>
            <Button onClick={copyLink} disabled={!paramOk || !isPublished || minting} variant="outline" className="gap-2">
              {minting ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : copied === "link" ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                : <Link2 className="w-3.5 h-3.5" />}
              {copied === "link" ? "Copied" : "Copy personalized link suffix"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The suffix (<code>?{paramOk ? param : DEFAULT_PARAM}=…</code>) goes on the end of the
            host site's URL — that visitor's slot then shows this page, and it sticks in their
            browser on later visits.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
