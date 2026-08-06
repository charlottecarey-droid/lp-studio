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
const MODE_STORAGE_PREFIX = "lpStudio.embedMode.";
const DEFAULT_PARAM = "lp_page";

type EmbedMode = "personalized" | "static";

/* Static embeds get a page-specific param: the loader always listens for
   tokens on its param (there is no off switch), so a unique name nobody
   mints links for makes "this slot never personalizes" true by
   construction. The shared lp_page default stays for personalized slots,
   where any minted link matching any default snippet is the point. */
const staticParamFor = (slug: string) =>
  ("lp_" + slug.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")).slice(0, 64) || DEFAULT_PARAM;

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

  const [mode, setMode] = useState<EmbedMode>(() => {
    try { return window.localStorage.getItem(MODE_STORAGE_PREFIX + page.id) === "static" ? "static" : "personalized"; } catch { return "personalized"; }
  });
  const [param, setParam] = useState<string>(() => {
    try {
      const stored = window.localStorage.getItem(PARAM_STORAGE_PREFIX + page.id);
      if (stored) return stored;
      return window.localStorage.getItem(MODE_STORAGE_PREFIX + page.id) === "static" ? staticParamFor(page.slug) : DEFAULT_PARAM;
    } catch { return DEFAULT_PARAM; }
  });

  const pickMode = (m: EmbedMode) => {
    setMode(m);
    setParam(m === "static" ? staticParamFor(page.slug) : DEFAULT_PARAM);
    try { window.localStorage.setItem(MODE_STORAGE_PREFIX + page.id, m); } catch {}
  };
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
          <div>
            <Label className="text-sm font-medium">How will this be used?</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                aria-pressed={mode === "static"}
                onClick={() => pickMode("static")}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${mode === "static" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}
              >
                <span className="block text-[13px] font-semibold">Static widget</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">Every visitor sees this page. Nothing can personalize the slot.</span>
              </button>
              <button
                type="button"
                aria-pressed={mode === "personalized"}
                onClick={() => pickMode("personalized")}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${mode === "personalized" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}
              >
                <span className="block text-[13px] font-semibold">Personalized by links</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">A link's token picks which page fills the slot; this page is the fallback.</span>
              </button>
            </div>
          </div>
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
            <p className="text-[11px] text-muted-foreground mt-1">
              {mode === "static"
                ? "Page-specific name, so links minted for other slots can never swap this one."
                : "Slots sharing a param follow the same link — give independent slots different names, and mint links with the same param as the installed snippet."}
            </p>
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
            {mode === "personalized" && (
              <Button onClick={copyLink} disabled={!paramOk || !isPublished || minting} variant="outline" className="gap-2">
                {minting ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : copied === "link" ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                  : <Link2 className="w-3.5 h-3.5" />}
                {copied === "link" ? "Copied" : "Copy personalized link suffix"}
              </Button>
            )}
          </div>
          {mode === "personalized" && (
            <p className="text-[11px] text-muted-foreground">
              The suffix (<code>?{paramOk ? param : DEFAULT_PARAM}=…</code>) goes on the end of the
              host site's URL — that visitor's slot then shows this page, and it sticks in their
              browser on later visits.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
