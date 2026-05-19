import { useState, useEffect, useCallback, useRef } from "react";
import { X, MousePointerClick, Calendar, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { PopupBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { safeNavigate } from "@/lib/safe-url";
import { pushMarketoSubmissionToDataLayer } from "@/lib/gtm-datalayer";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: PopupBlockProps;
  brand: BrandConfig;
  blockId: string;
  isEditing?: boolean;
  /** When true (LP Studio builder canvas), suppress any fixed/portal overlays
   *  so the popup never covers the builder's top bar / control rails. The
   *  editor card is still rendered for inline editing. */
  isBuilder?: boolean;
  pageId?: number;
  variantId?: string;
  sessionId?: string;
  onCtaClick?: () => void;
}

// ── Chili Piper booking modal ──────────────────────────────────────────────
function ChilipiperModal({
  p, brand, pageId, variantId, sessionId, onClose,
}: {
  p: PopupBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: string;
  sessionId?: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"form" | "calendar">("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build the Chili Piper iframe URL — append email param if supported
  const cpUrl = (() => {
    if (!p.chilipiperUrl) return "";
    try {
      const u = new URL(p.chilipiperUrl);
      if (email) u.searchParams.set("email", email);
      if (name) u.searchParams.set("name", name);
      return u.toString();
    } catch {
      return p.chilipiperUrl;
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setSubmitting(true);

    const fields: Record<string, string> = { email: trimmedEmail };
    if (p.chilipiperCaptureName && name.trim()) fields["name"] = name.trim();

    try {
      await fetch("/api/lp/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: pageId ?? null,
          variantId: variantId ?? null,
          sessionId: sessionId ?? null,
          formId: null,
          fields,
          source: "popup-chilipiper",
        }),
      });
    } catch {
      // Lead capture is best-effort — still show calendar on failure
    }

    // GTM dataLayer push (marketing's "Marketo Form Submission" event).
    // Helper dedupes per page load and is safe to call after any submit.
    try {
      pushMarketoSubmissionToDataLayer();
    } catch (err) {
      console.error("[lp-studio] dataLayer push threw:", err);
    }

    setSubmitting(false);
    setStep("calendar");
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ animation: "lp-fadeIn 0.2s ease-out" }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative z-10 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          width: step === "calendar" ? "min(780px, 96vw)" : "min(440px, 96vw)",
          maxHeight: "90vh",
          animation: "lp-scaleIn 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--brand-primary)]" />
            <span className="text-sm font-semibold text-slate-800">
              {step === "form" ? "Book a call" : "Pick a time"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "form" ? (
          /* ── Step 1: email capture ──────────────────────────────── */
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            <p className="text-sm text-slate-500" style={{ fontFamily: BODY }}>
              Enter your details and we'll take you straight to the calendar.
            </p>

            {p.chilipiperCaptureName && (
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/0.1)] transition-all"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                placeholder="you@company.com"
                required
                autoFocus
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all",
                  emailError
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
                    : "border-slate-200 focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/0.1)]"
                )}
              />
              {emailError && <p className="text-xs text-red-500 mt-1" style={{ fontFamily: BODY }}>{emailError}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60"
              style={{
                backgroundColor: p.ctaColor || brand.ctaBackground || "var(--brand-accent)",
                color: brand.ctaText || "var(--brand-primary)",
              }}
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <>{p.ctaText || "Book a call"} <ChevronRight className="w-4 h-4" /></>}
            </button>

            <p className="text-[10px] text-slate-400 text-center" style={{ fontFamily: BODY }}>
              Your info is shared only for scheduling purposes.
            </p>
          </form>
        ) : (
          /* ── Step 2: Chili Piper iframe ─────────────────────────── */
          <div className="flex-1 overflow-hidden" style={{ minHeight: 520 }}>
            <iframe
              ref={iframeRef}
              src={cpUrl}
              className="w-full h-full border-0"
              style={{ minHeight: 520 }}
              allow="camera; microphone"
              title="Schedule a meeting"
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes lp-fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lp-scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  );
}

// ── Popup overlay (non-Chili Piper) ───────────────────────────────────────
function PopupOverlay({
  p, brand, onDismiss,
}: {
  p: PopupBlockProps;
  brand: BrandConfig;
  onDismiss: () => void;
}) {
  const isDark = isDarkBg(p.backgroundStyle);
  const positionClass =
    p.position === "bottom-left" ? "items-end justify-start p-6"
    : p.position === "bottom-right" ? "items-end justify-end p-6"
    : "items-center justify-center";

  return (
    <div className={cn("fixed inset-0 z-[9999] flex", positionClass)} style={{ animation: "lp-fadeIn 0.2s ease-out" }}>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${(p.overlayOpacity ?? 50) / 100})` }}
        onClick={onDismiss}
      />
      <div
        className={cn(
          "relative rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden",
          isDark ? "text-white" : "text-slate-900"
        )}
        style={{ animation: "lp-scaleIn 0.25s ease-out", ...getBgStyle(p.backgroundStyle) }}
      >
        <button
          onClick={onDismiss}
          className={cn(
            "absolute top-3 right-3 p-1 rounded-full transition-colors z-10",
            isDark ? "hover:bg-white/10 text-white/70" : "hover:bg-slate-100 text-slate-400"
          )}
        >
          <X className="w-5 h-5" />
        </button>

        {p.imageUrl && (
          <div className="w-full h-40 overflow-hidden">
            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6">
          {p.headline && <h3 className="text-xl font-bold mb-2" style={{ fontFamily: DISPLAY }}>{p.headline}</h3>}
          {p.body && (
            <p className={cn("text-sm mb-4", isDark ? "text-white/70" : "text-slate-600")} style={{ fontFamily: BODY }}>{p.body}</p>
          )}
          {p.ctaText && (
            <button
              onClick={onDismiss}
              className="w-full py-3 px-6 rounded-lg font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: p.ctaColor || brand.ctaBackground || "var(--brand-accent)",
                color: brand.ctaText || "var(--brand-primary)",
              }}
            >
              {p.ctaText}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes lp-fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lp-scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export function BlockPopup({ props: p, brand, blockId, isEditing, isBuilder, pageId, variantId, sessionId, onCtaClick }: Props) {
  // In builder mode treat popup like editing — never auto-display, never open
  // fixed-position overlays (preview / Chili Piper modal) over builder chrome.
  const editorMode = isEditing || isBuilder;
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cpOpen, setCpOpen] = useState(false);

  const storageKey = `lp-popup-${blockId}-dismissed`;
  const isChiliPiper = p.ctaType === "chilipiper" && !!p.chilipiperUrl;

  const dismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
    if (p.showOnce) {
      try { sessionStorage.setItem(storageKey, "1"); } catch { /* ok */ }
    }
  }, [p.showOnce, storageKey]);

  const handleCtaClick = () => {
    onCtaClick?.();
    if (isChiliPiper) {
      dismiss();
      setCpOpen(true);
    } else {
      if (p.ctaUrl) safeNavigate(p.ctaUrl, "_blank");
      dismiss();
    }
  };

  // Live trigger logic
  useEffect(() => {
    if (editorMode) return;
    if (dismissed) return;
    if (p.showOnce) {
      try { if (sessionStorage.getItem(storageKey)) return; } catch { /* ok */ }
    }
    if (p.trigger === "click") return;

    if (p.trigger === "exit-intent") {
      const handler = (e: MouseEvent) => { if (e.clientY <= 0) setVisible(true); };
      document.addEventListener("mouseout", handler);
      return () => document.removeEventListener("mouseout", handler);
    }

    if (p.trigger === "scroll-percent") {
      const handler = () => {
        const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        if (pct >= (p.triggerValue || 50)) setVisible(true);
      };
      window.addEventListener("scroll", handler, { passive: true });
      return () => window.removeEventListener("scroll", handler);
    }

    if (p.trigger === "time-delay") {
      const timer = setTimeout(() => setVisible(true), (p.triggerValue || 5) * 1000);
      return () => clearTimeout(timer);
    }
    return;
  }, [p.trigger, p.triggerValue, p.showOnce, dismissed, storageKey, editorMode]);

  // ── EDITOR MODE ───────────────────────────────────────────────────────────
  if (editorMode) {
    const triggerLabel =
      p.trigger === "exit-intent" ? "Exit intent"
      : p.trigger === "scroll-percent" ? `Scroll ${p.triggerValue ?? 50}%`
      : p.trigger === "time-delay" ? `After ${p.triggerValue ?? 5}s`
      : "Button click";

    return (
      <>
        <div className="relative mx-auto my-2 max-w-md rounded-xl border-2 border-dashed border-[rgb(var(--brand-accent-rgb)/0.6)] bg-[rgb(var(--brand-accent-rgb)/0.05)] p-4 flex items-center gap-4">
          {p.imageUrl && (
            <img src={p.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--brand-primary-rgb)/0.5)]">Popup</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgb(var(--brand-accent-rgb)/0.3)] text-[var(--brand-primary)] font-medium">{triggerLabel}</span>
              {isChiliPiper && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />Chili Piper
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate" style={{ fontFamily: BODY }}>{p.headline || "(no headline)"}</p>
            {p.body && <p className="text-xs text-slate-500 truncate mt-0.5" style={{ fontFamily: BODY }}>{p.body}</p>}
          </div>
          {!isBuilder && (
            <button
              onClick={() => setPreviewOpen(true)}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white hover:bg-[rgb(var(--brand-primary-rgb)/0.8)] transition-colors"
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              Preview
            </button>
          )}
        </div>

        {/* Preview: non-CP popup overlay (suppressed in builder so it can't
            cover the builder's top bar / control rails). */}
        {previewOpen && !isChiliPiper && !isBuilder && (
          <div className={cn("fixed inset-0 z-[9999] flex",
            p.position === "bottom-left" ? "items-end justify-start p-6"
            : p.position === "bottom-right" ? "items-end justify-end p-6"
            : "items-center justify-center"
          )}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewOpen(false)} />
            <div
              className={cn("relative rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden", isDarkBg(p.backgroundStyle) ? "text-white" : "text-slate-900")}
              style={getBgStyle(p.backgroundStyle)}
            >
              <button onClick={() => setPreviewOpen(false)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
              {p.imageUrl && <div className="w-full h-40 overflow-hidden"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
              <div className="p-6">
                {p.headline && <h3 className="text-xl font-bold mb-2" style={{ fontFamily: DISPLAY }}>{p.headline}</h3>}
                {p.body && <p className={cn("text-sm mb-4", isDarkBg(p.backgroundStyle) ? "text-white/70" : "text-slate-600")} style={{ fontFamily: BODY }}>{p.body}</p>}
                {p.ctaText && (
                  <button
                    className="w-full py-3 px-6 rounded-lg font-semibold text-sm"
                    style={{ backgroundColor: p.ctaColor || "var(--brand-accent)", color: brand.ctaText || "var(--brand-primary)" }}
                    onClick={() => setPreviewOpen(false)}
                  >
                    {p.ctaText}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Preview: Chili Piper flow */}
        {previewOpen && isChiliPiper && (
          <ChilipiperModal
            p={p} brand={brand}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </>
    );
  }

  // ── LIVE: click trigger ───────────────────────────────────────────────────
  if (p.trigger === "click") {
    return (
      <>
        <div className="flex justify-center py-4">
          <button
            onClick={() => { if (isChiliPiper) setCpOpen(true); else setVisible(true); }}
            className="py-3 px-8 rounded-lg font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: p.ctaColor || brand.ctaBackground || "var(--brand-accent)",
              color: brand.ctaText || "var(--brand-primary)",
            }}
          >
            {isChiliPiper
              ? <span className="flex items-center gap-2"><Calendar className="w-4 h-4" />{p.ctaText || "Book a call"}</span>
              : p.ctaText || "Open"
            }
          </button>
        </div>

        {cpOpen && (
          <ChilipiperModal
            p={p} brand={brand}
            pageId={pageId} variantId={variantId} sessionId={sessionId}
            onClose={() => setCpOpen(false)}
          />
        )}
        {visible && !dismissed && (
          <PopupOverlay p={p} brand={brand} onDismiss={handleCtaClick} />
        )}
      </>
    );
  }

  // ── LIVE: auto-triggered popup ────────────────────────────────────────────
  if (!visible || dismissed) {
    return cpOpen ? (
      <ChilipiperModal
        p={p} brand={brand}
        pageId={pageId} variantId={variantId} sessionId={sessionId}
        onClose={() => setCpOpen(false)}
      />
    ) : null;
  }

  // Popup is visible — CTA either goes to URL or opens CP
  const PopupContent = (
    <div className={cn(
      "fixed inset-0 z-[9999] flex",
      p.position === "bottom-left" ? "items-end justify-start p-6"
      : p.position === "bottom-right" ? "items-end justify-end p-6"
      : "items-center justify-center"
    )} style={{ animation: "lp-fadeIn 0.2s ease-out" }}>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${(p.overlayOpacity ?? 50) / 100})` }}
        onClick={dismiss}
      />
      <div
        className={cn(
          "relative rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden",
          isDarkBg(p.backgroundStyle) ? "text-white" : "text-slate-900"
        )}
        style={{ animation: "lp-scaleIn 0.25s ease-out", ...getBgStyle(p.backgroundStyle) }}
      >
        <button onClick={dismiss} className={cn("absolute top-3 right-3 p-1 rounded-full transition-colors z-10", isDarkBg(p.backgroundStyle) ? "hover:bg-white/10 text-white/70" : "hover:bg-slate-100 text-slate-400")}>
          <X className="w-5 h-5" />
        </button>
        {p.imageUrl && <div className="w-full h-40 overflow-hidden"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
        <div className="p-6">
          {p.headline && <h3 className="text-xl font-bold mb-2" style={{ fontFamily: DISPLAY }}>{p.headline}</h3>}
          {p.body && <p className={cn("text-sm mb-4", isDarkBg(p.backgroundStyle) ? "text-white/70" : "text-slate-600")} style={{ fontFamily: BODY }}>{p.body}</p>}
          {p.ctaText && (
            <button
              onClick={handleCtaClick}
              className="w-full py-3 px-6 rounded-lg font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ backgroundColor: p.ctaColor || brand.ctaBackground || "var(--brand-accent)", color: brand.ctaText || "var(--brand-primary)" }}
            >
              {isChiliPiper && <Calendar className="w-4 h-4" />}
              {p.ctaText}
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes lp-fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lp-scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  );

  return (
    <>
      {PopupContent}
      {cpOpen && (
        <ChilipiperModal
          p={p} brand={brand}
          pageId={pageId} variantId={variantId} sessionId={sessionId}
          onClose={() => setCpOpen(false)}
        />
      )}
    </>
  );
}
