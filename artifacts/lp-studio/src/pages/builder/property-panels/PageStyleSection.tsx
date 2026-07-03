/**
 * Page Settings → "Match style from URL" (brand-fidelity, July 2026).
 *
 * Paste any site URL and the importer's extractors pull its visual tokens —
 * colors, fonts, button styling, card radius/shadow, layout density — and
 * store them as page-level style overrides (lp_pages.style_overrides). The
 * canvas + published page merge them over the tenant brand at render time;
 * "Remove" is a one-click reset back to the brand. Explicit action only:
 * nothing here runs during generation.
 *
 * The extraction can take up to a minute cold (full site scrape); repeat
 * matches on the same URL are served from the importer's 24h cache.
 */
import { useState } from "react";
import { Loader2, Paintbrush, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasPageStyleOverrides } from "@/lib/page-style-overrides";

const API_BASE = "/api";

export interface PageStyleSectionProps {
  pageId: number;
  /** The page's current style overrides (null/undefined = none). */
  value: Record<string, unknown> | null;
  /** Fired with the fresh overrides after a successful match. */
  onApplied: (overrides: Record<string, unknown>, sourceUrl: string) => void;
  /** Fired after a successful reset. */
  onCleared: () => void;
}

/** Short human summary of what a match applied ("Colors · Fonts · Buttons"). */
function appliedGroups(overrides: Record<string, unknown>): string {
  const groups: string[] = [];
  const keys = Object.keys(overrides);
  if (keys.some((k) => /color|Background|ctaText|navText|secondary\d/i.test(k))) groups.push("Colors");
  if (keys.some((k) => /Font/.test(k))) groups.push("Fonts");
  if (keys.some((k) => /^button|StyleRaw/.test(k))) groups.push("Buttons");
  if (keys.some((k) => /^card/.test(k))) groups.push("Cards");
  if (keys.includes("layoutDensity")) groups.push("Density");
  return groups.join(" · ");
}

export function PageStyleSection({ pageId, value, onApplied, onCleared }: PageStyleSectionProps) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"match" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const active = hasPageStyleOverrides(value);

  const match = async () => {
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    setBusy("match");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/style-from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: trimmed }),
      });
      const body = (await res.json().catch(() => null)) as
        | { styleOverrides?: Record<string, unknown>; sourceUrl?: string; error?: string }
        | null;
      if (!res.ok || !body?.styleOverrides) {
        setError(body?.error ?? `Style match failed (${res.status})`);
        return;
      }
      setSourceUrl(body.sourceUrl ?? trimmed);
      onApplied(body.styleOverrides, body.sourceUrl ?? trimmed);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(null);
    }
  };

  const clear = async () => {
    if (busy) return;
    setBusy("clear");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/style-from-url`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Reset failed (${res.status})`);
        return;
      }
      setSourceUrl(null);
      onCleared();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Paintbrush className="w-3.5 h-3.5" aria-hidden />
        Match style from URL
      </Label>

      {active && value ? (
        <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2 space-y-1">
          <p className="text-xs text-foreground font-medium">
            Styled like a reference site
            {sourceUrl ? <span className="text-muted-foreground font-normal"> — {sourceUrl}</span> : null}
          </p>
          <p className="text-[11px] text-muted-foreground">{appliedGroups(value)} override your brand on this page only.</p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => void clear()}
            disabled={busy !== null}
          >
            {busy === "clear" ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <X className="w-3 h-3" aria-hidden />}
            Remove — back to my brand
          </Button>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Pull colors, fonts, and button/card styling from any site and apply
            them to this page only. Your brand settings are untouched.
          </p>
          <div className="flex gap-1.5">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void match(); }}
              placeholder="https://example.com"
              className="h-8 text-xs"
              disabled={busy !== null}
            />
            <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => void match()} disabled={busy !== null || !url.trim()}>
              {busy === "match" ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : "Match"}
            </Button>
          </div>
          {busy === "match" && (
            <p className="text-[11px] text-muted-foreground">Analyzing the site — up to a minute on the first visit…</p>
          )}
        </>
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
