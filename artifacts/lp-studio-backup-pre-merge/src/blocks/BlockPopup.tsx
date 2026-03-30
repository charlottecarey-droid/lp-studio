import { useState, useEffect, useCallback, useRef } from "react";
import { X, MousePointerClick, Calendar, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PopupBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: PopupBlockProps;
  brand: BrandConfig;
  blockId: string;
  isEditing?: boolean;
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
            <Calendar className="w-4 h-4 text-[#003A30]" />
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
            <p className="text-sm text-slate-500">
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#003A30] focus:ring-2 focus:ring-[#003A30]/10 transition-all"
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
                    : "border-slate-200 focus:border-[#003A30] focus:ring-2 focus:ring-[#003A30]/10"
                )}
              />
              {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60"
              style={{
                backgroundColor: p.ctaColor || brand.ctaBackground || "#C7E738",
                color: brand.ctaText || "#003A30",
              }}
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <>{p.ctaText || "Book a call"} <ChevronRight className="w-4 h-4" /></>}
            </button>

            <p className="text-[10px] text-slate-400 text-center">
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
  const isDark = p.backgroundStyle === "dark";
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
          isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        )}
        style={{ animation: "lp-scaleIn 0.25s ease-out" }}
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
          {p.headline && <h3 className="text-xl font-bold mb-2">{p.headline}</h3>}
          {p.body && (
            <p className={cn("text-sm mb-4", isDark ? "text-white/70" : "text-slate-600")}>{p.body}</p>
          )}
          {p.ctaText && (
            <button
              onClick={onDismiss}
              className="w-full py-3 px-6 rounded-lg font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: p.ctaColor || brand.ctaBackground || "#C7E738",
                color: brand.ctaText || "#003A30",
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
export function BlockPopup({ props: p, brand, blockId, isEditing, pageId, variantId, sessionId, onCtaClick }: Props) {
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
      if (p.ctaUrl) window.open(p.ctaUrl, "_blank", "noopener,noreferrer");
      dismiss();
    }
  };

  // Live trigger logic
  useEffect(() => {
    if (isEditing) return;
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
  }, [p.trigger, p.triggerValue, p.showOnce, dismissed, storageKey, isEditing]);

  // ── EDITOR MODE ───────────────────────────────────────────────────────────
  if (isEditing) {
    const triggerLabel =
      p.trigger === "exit-intent" ? "Exit intent"
      : p.trigger === "scroll-percent" ? `Scroll ${p.triggerValue ?? 50}%`
      : p.trigger === "time-delay" ? `After ${p.triggerValue ?? 5}s`
      : "Button click";

    return (
      <>
        <div className="relative mx-auto my-2 max-w-md rounded-xl border-2 border-dashed border-[#C7E738]/60 bg-[#C7E738]/5 p-4 flex items-center gap-4">
          {p.imageUrl && (
            <img src={p.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#003A30]/50">Popup</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#C7E738]/30 text-[#003A30] font-medium">{triggerLabel}</span>
              {isChiliPiper && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />Chili Piper
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate">{p.headline || "(no headline)"}</p>
            {p.body && <p className="text-xs text-slate-500 truncate mt-0.5">{p.body}</p>}
          </div>
          <button
            onClick={() => setPreviewOpen(true)}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#003A30] text-white hover:bg-[#003A30]/80 transition-colors"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>

        {/* Preview: non-CP popup overlay */}
        {previewOpen && !isChiliPiper && (
          <div className={cn("fixed inset-0 z-[9999] flex",
            p.position === "bottom-left" ? "items-end justify-start p-6"
            : p.position === "bottom-right" ? "items-end justify-end p-6"
            : "items-center justify-center"
          )}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewOpen(false)} />
            <div className={cn(
              "relative rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden",
              p.backgroundStyle === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"
            )}>
              <button onClick={() => setPreviewOpen(false)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
              {p.imageUrl && <div className="w-full h-40 overflow-hidden"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
              <div className="p-6">
                {p.headline && <h3 className="text-xl font-bold mb-2">{p.headline}</h3>}
                {p.body && <p className={cn("text-sm mb-4", p.backgroundStyle === "dark" ? "text-white/70" : "text-slate-600")}>{p.body}</p>}
                {p.ctaText && (
                  <button
                    className="w-full py-3 px-6 rounded-lg font-semibold text-sm"
                    style={{ backgroundColor: p.ctaColor || "#C7E738", color: brand.ctaText || "#003A30" }}
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
              backgroundColor: p.ctaColor || brand.ctaBackground || "#C7E738",
              color: brand.ctaText || "#003A30",
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
          p.backgroundStyle === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        )}
        style={{ animation: "lp-scaleIn 0.25s ease-out" }}
      >
        <button onClick={dismiss} className={cn("absolute top-3 right-3 p-1 rounded-full transition-colors z-10", p.backgroundStyle === "dark" ? "hover:bg-white/10 text-white/70" : "hover:bg-slate-100 text-slate-400")}>
          <X className="w-5 h-5" />
        </button>
        {p.imageUrl && <div className="w-full h-40 overflow-hidden"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
        <div className="p-6">
          {p.headline && <h3 className="text-xl font-bold mb-2">{p.headline}</h3>}
          {p.body && <p className={cn("text-sm mb-4", p.backgroundStyle === "dark" ? "text-white/70" : "text-slate-600")}>{p.body}</p>}
          {p.ctaText && (
            <button
              onClick={handleCtaClick}
              className="w-full py-3 px-6 rounded-lg font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ backgroundColor: p.ctaColor || brand.ctaBackground || "#C7E738", color: brand.ctaText || "#003A30" }}
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
