/**
 * Custom HTML → native CTA bridge.
 *
 * A custom-html block renders in a sandboxed, opaque-origin iframe, so it
 * can't call into the page. It can ask the page to open LP Studio's own CTA
 * modals instead:
 *
 *   window.parent.postMessage({ __lpOpenCta: { mode: "chilipiper", email } }, "*")
 *
 * mode:  "chilipiper" — the Chili Piper scheduler, prefilled with `email`
 *        "form"       — the lead-form modal (page/workspace CTA form settings)
 *        "cta"        — whatever the page's default CTA does
 * url:   optional Chili Piper URL (https, *.chilipiper.com only); otherwise the
 *        page CTA's, then the workspace's, Chili Piper URL is used.
 *
 * This module only validates the message and decides what to open. Pure.
 */
import type { CtaConfig } from "@/lib/cta/ctaConfig";

export type LpCtaRequest = { mode: "chilipiper" | "form" | "cta"; email: string; url?: string };

export type LpCtaAction =
  | { kind: "chilipiper"; url: string; email: string }
  | { kind: "form"; email: string }
  | { kind: "navigate"; url: string }
  | { kind: "none"; reason: string };

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;

export function isChiliPiperUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 2000) return false;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && (h === "chilipiper.com" || h.endsWith(".chilipiper.com"));
  } catch {
    return false;
  }
}

/** The `__lpOpenCta` payload of a message, validated, or null when it isn't one. */
export function parseLpCtaMessage(data: unknown): LpCtaRequest | null {
  if (!data || typeof data !== "object") return null;
  const req = (data as { __lpOpenCta?: unknown }).__lpOpenCta;
  if (!req || typeof req !== "object") return null;
  const r = req as { mode?: unknown; email?: unknown; url?: unknown };
  const mode = r.mode === "chilipiper" || r.mode === "form" || r.mode === "cta" ? r.mode : null;
  if (!mode) return null;
  const email = typeof r.email === "string" && EMAIL_RE.test(r.email.trim()) ? r.email.trim() : "";
  return { mode, email, ...(isChiliPiperUrl(r.url) ? { url: r.url } : {}) };
}

/** What to open for a request, given the resolved page CTA and the brand's Chili Piper URL. */
export function resolveLpCtaAction(req: LpCtaRequest, cta: CtaConfig, brandChiliPiperUrl?: string | null): LpCtaAction {
  const cpUrl = req.url ?? cta.modalChilipiperUrl ?? cta.chilipiper ?? brandChiliPiperUrl ?? "";
  const chili = (): LpCtaAction => (cpUrl ? { kind: "chilipiper", url: cpUrl, email: req.email } : { kind: "none", reason: "No Chili Piper URL is set on this page or workspace." });
  if (req.mode === "chilipiper") return chili();
  if (req.mode === "form") return { kind: "form", email: req.email };
  switch (cta.action) {
    case "chilipiper":
    case "modal-chilipiper":
      return chili();
    case "modal-form":
      return { kind: "form", email: req.email };
    case "url":
      return cta.url && /^https?:\/\//i.test(cta.url) ? { kind: "navigate", url: cta.url } : { kind: "none", reason: "The page CTA has no link." };
    default:
      return { kind: "none", reason: "The page CTA can't be opened from custom HTML." };
  }
}
