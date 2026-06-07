import React, { useState } from "react";
import { ArrowRight, Check, Calendar, X, Mail } from "lucide-react";

/**
 * Shared, brand-swappable CTA block for section mockups.
 *
 * Three interactive variants (mirrors the production cta-button options):
 *  - "link"  : one or two buttons that link somewhere.
 *  - "form"  : an inline email-capture form (input + submit) with a success state.
 *  - "modal" : a button that opens a modal containing either a lead form
 *              ("form") or a booking-style time picker ("booking").
 *
 * All colors are driven by props so the block re-skins per brand. Sensible
 * neutral + indigo defaults let it render standalone on its preview route.
 */
export type MockupCTAVariant = "link" | "form" | "modal";
export type MockupCTAModalKind = "form" | "booking";

export interface MockupCTAProps {
  /** Which interaction to render. Omit / set "none" upstream to hide entirely. */
  variant?: MockupCTAVariant;
  /** Primary brand color (button fill, accents). */
  accent?: string;
  /** Text/icon color that sits on top of `accent`. */
  accentText?: string;
  /** Panel/surface background (modal, form card). */
  surface?: string;
  /** Heading text color. */
  ink?: string;
  /** Muted/secondary text color. */
  muted?: string;
  /** Border / divider color. */
  border?: string;

  /** Optional intro copy shown above the action. */
  eyebrow?: string;
  heading?: string;
  subheading?: string;

  /** Primary button label. */
  primaryLabel?: string;
  /** Optional secondary (ghost/outline) button label — "link" variant only. */
  secondaryLabel?: string;

  /** Email placeholder for the "form" variant and modal form. */
  placeholder?: string;
  /** Layout alignment of the intro + action. */
  align?: "left" | "center";

  /** Modal copy + content type — "modal" variant only. */
  modalTitle?: string;
  modalSubtitle?: string;
  modalKind?: MockupCTAModalKind;

  /** Extra classes for the outer wrapper. */
  className?: string;
}

const BOOKING_SLOTS = ["9:00 AM", "10:30 AM", "1:00 PM", "2:30 PM", "4:00 PM"];

export function MockupCTA({
  variant = "link",
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow,
  heading,
  subheading,
  primaryLabel = "Get started",
  secondaryLabel,
  placeholder = "you@company.com",
  align = "center",
  modalTitle = "Book a demo",
  modalSubtitle = "Pick a time that works — it takes 30 seconds.",
  modalKind = "form",
  className = "",
}: MockupCTAProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);

  const alignCls = align === "center" ? "items-center text-center" : "items-start text-left";

  const primaryBtn = (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-95 focus:outline-none"
      style={{ backgroundColor: accent, color: accentText }}
    >
      {primaryLabel}
      <ArrowRight className="h-4 w-4" />
    </button>
  );

  const intro = (eyebrow || heading || subheading) && (
    <div className={`flex flex-col gap-3 ${align === "center" ? "items-center" : "items-start"}`}>
      {eyebrow && (
        <span
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </span>
      )}
      {heading && (
        <h3
          className="text-2xl md:text-3xl font-extrabold tracking-tight"
          style={{ color: ink }}
        >
          {heading}
        </h3>
      )}
      {subheading && (
        <p className="max-w-xl text-base md:text-lg" style={{ color: muted }}>
          {subheading}
        </p>
      )}
    </div>
  );

  // ---- LINK ----------------------------------------------------------------
  if (variant === "link") {
    return (
      <div className={`flex flex-col gap-7 ${alignCls} ${className}`}>
        {intro}
        <div className={`flex flex-wrap gap-3 ${align === "center" ? "justify-center" : "justify-start"}`}>
          {primaryBtn}
          {secondaryLabel && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold transition-colors duration-200 hover:bg-black/[0.03] focus:outline-none"
              style={{ borderColor: border, color: ink }}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- FORM (inline) -------------------------------------------------------
  if (variant === "form") {
    return (
      <div className={`flex flex-col gap-7 ${alignCls} ${className}`}>
        {intro}
        {submitted ? (
          <div
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-base font-semibold"
            style={{ backgroundColor: `${accent}14`, color: accent }}
          >
            <Check className="h-5 w-5" />
            You&apos;re on the list — check your inbox.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            className={`flex w-full max-w-md flex-col gap-3 sm:flex-row ${align === "center" ? "mx-auto" : ""}`}
          >
            <div
              className="flex flex-1 items-center gap-2 rounded-xl border px-4"
              style={{ borderColor: border, backgroundColor: surface }}
            >
              <Mail className="h-4 w-4 shrink-0" style={{ color: muted }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent py-3.5 text-base outline-none"
                style={{ color: ink }}
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-95 focus:outline-none"
              style={{ backgroundColor: accent, color: accentText }}
            >
              {primaryLabel}
            </button>
          </form>
        )}
      </div>
    );
  }

  // ---- MODAL ---------------------------------------------------------------
  return (
    <div className={`flex flex-col gap-7 ${alignCls} ${className}`}>
      {intro}
      <div className={align === "center" ? "flex justify-center" : "flex justify-start"}>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSubmitted(false);
            setSlot(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-95 focus:outline-none"
          style={{ backgroundColor: accent, color: accentText }}
        >
          {modalKind === "booking" ? <Calendar className="h-4 w-4" /> : null}
          {primaryLabel}
          {modalKind !== "booking" ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.55)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl p-7 text-left shadow-2xl"
            style={{ backgroundColor: surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors hover:bg-black/[0.05]"
              style={{ color: muted }}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accent}14`, color: accent }}
                >
                  <Check className="h-7 w-7" />
                </div>
                <h4 className="text-xl font-bold" style={{ color: ink }}>
                  {modalKind === "booking" ? "You're booked!" : "Thanks — we'll be in touch."}
                </h4>
                <p className="text-sm" style={{ color: muted }}>
                  {modalKind === "booking" && slot
                    ? `See you at ${slot}.`
                    : "A member of our team will reach out shortly."}
                </p>
              </div>
            ) : (
              <>
                <h4 className="text-xl font-bold" style={{ color: ink }}>
                  {modalTitle}
                </h4>
                <p className="mt-1.5 text-sm" style={{ color: muted }}>
                  {modalSubtitle}
                </p>

                {modalKind === "booking" ? (
                  <div className="mt-6">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {BOOKING_SLOTS.map((s) => {
                        const active = slot === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSlot(s)}
                            className="rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors"
                            style={{
                              borderColor: active ? accent : border,
                              backgroundColor: active ? accent : surface,
                              color: active ? accentText : ink,
                            }}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={!slot}
                      onClick={() => setSubmitted(true)}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ backgroundColor: accent, color: accentText }}
                    >
                      Confirm booking
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSubmitted(true);
                    }}
                    className="mt-6 flex flex-col gap-3"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Full name"
                      className="w-full rounded-xl border px-4 py-3.5 text-base outline-none"
                      style={{ borderColor: border, color: ink, backgroundColor: surface }}
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={placeholder}
                      className="w-full rounded-xl border px-4 py-3.5 text-base outline-none"
                      style={{ borderColor: border, color: ink, backgroundColor: surface }}
                    />
                    <button
                      type="submit"
                      className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-opacity hover:opacity-95"
                      style={{ backgroundColor: accent, color: accentText }}
                    >
                      {primaryLabel}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MockupCTA;
