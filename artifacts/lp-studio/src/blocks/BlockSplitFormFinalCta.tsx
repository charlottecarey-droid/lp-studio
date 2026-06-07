import { useState } from "react";
import { Check } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { SplitFormFinalCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { usePageContext } from "@/lib/page-context";

interface Props {
  props: SplitFormFinalCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: SplitFormFinalCtaBlockProps) => void;
}

/**
 * Split-form final CTA. Unlike the other final-CTA blocks (which expose the
 * shared CtaButton action suite — url / chilipiper / modal-form / video), this
 * block is intentionally an INLINE lead-capture form: the on-page email input
 * IS the conversion action. It therefore submits the lead directly through the
 * shared `/api/lp/leads` pipeline (same endpoint as EmailCaptureModal) rather
 * than wiring a CtaActionConfigSection. This inline-form scope is deliberate.
 */
export function BlockSplitFormFinalCta({ props, brand, onFieldChange }: Props) {
  const ctx = usePageContext();
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const bg = props.bgColor ?? accent;
  const ink = props.textColor ?? pickContrastingColor(undefined, bg, ["#FFFFFF", "#0F172A"]);
  const muted = `${ink}D9`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const bullets = props.bullets ?? [];
  const editing = !!onFieldChange;

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof SplitFormFinalCtaBlockProps>(key: K, value: SplitFormFinalCtaBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateBullet = (i: number, v: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, bullets: bullets.map((b, idx) => (idx === i ? v : b)) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing || !email) return;
    setSubmitted(true);
    const pageId = ctx.pageId;
    if (!pageId) return;
    try {
      await fetch("/api/lp/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          variantId: ctx.variantId,
          fields: { email, source: "split-form-final-cta" },
        }),
      });
    } catch {
      // Lead capture is best-effort; the success state is already shown.
    }
  };

  return (
    <section className="w-full px-6 py-20 sm:py-28" style={{ backgroundColor: bg, color: ink, fontFamily: BODY }}>
      <div className="container mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 md:grid-cols-2">
        <div>
          {(props.eyebrow || onFieldChange) && (
            <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: ink, opacity: 0.85 }} />
          )}
          <InlineText as="h2" value={props.heading} onUpdate={onFieldChange ? (v) => update("heading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: ink, fontFamily: DISPLAY }} />
          {(props.subheading || onFieldChange) && (
            <InlineText as="p" value={props.subheading ?? ""} onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined} className="mt-4 text-lg leading-relaxed" style={{ color: muted }} multiline />
          )}
          {bullets.length > 0 && (
            <ul className="mt-6 space-y-3">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: ink }} />
                  <InlineText as="span" value={b} onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined} className="text-base leading-relaxed" style={{ color: ink }} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-xl sm:p-8" style={{ fontFamily: BODY }}>
          {submitted ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}1A` }}>
                <Check className="h-6 w-6" style={{ color: accent }} />
              </div>
              <p className="text-base font-semibold text-slate-900">{props.successMessage || "Thanks — we'll be in touch shortly."}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {(props.formTitle || onFieldChange) && (
                <InlineText as="h3" value={props.formTitle ?? ""} onUpdate={onFieldChange ? (v) => update("formTitle", v) : undefined} className="mb-4 text-lg font-bold text-slate-900" style={{ fontFamily: DISPLAY }} />
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={editing}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none focus:border-slate-400"
              />
              <button
                type="submit"
                className="mt-3 w-full rounded-xl px-6 py-3.5 text-base font-semibold shadow-sm"
                style={{ backgroundColor: accent, color: onAccent }}
              >
                {props.formButtonLabel || "Get started"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
