import { useState } from "react";
import { Check, Loader2, Calendar } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { SplitFormFinalCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { usePageContext } from "@/lib/page-context";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: SplitFormFinalCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: SplitFormFinalCtaBlockProps) => void;
}

type FormState = "idle" | "loading" | "success";

/**
 * Split-form final CTA. Persuasive copy on one side, a real native lead-capture
 * form (name / work email / phone) on the other. On submit the lead is recorded
 * through the shared `/api/lp/leads` pipeline (same endpoint as the Dandy form
 * block and EmailCaptureModal). If a Chili Piper booking URL is configured, the
 * success state offers a "Schedule a call" handoff.
 */
export function BlockSplitFormFinalCta({ props, brand, onFieldChange }: Props) {
  const ctx = usePageContext();
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#4f46e5";
  const surface = resolveSectionSurface(props, accent);
  const ink = props.textColor ?? surface.color ?? pickContrastingColor(undefined, surface.base, ["#FFFFFF", "#0F172A"]);
  const muted = `${ink}D9`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const bullets = props.bullets ?? [];
  const editing = !!onFieldChange;

  const [fields, setFields] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [formState, setFormState] = useState<FormState>("idle");

  const update = <K extends keyof SplitFormFinalCtaBlockProps>(key: K, value: SplitFormFinalCtaBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateBullet = (i: number, v: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, bullets: bullets.map((b, idx) => (idx === i ? v : b)) });
  };

  const openBooking = () => {
    if (!props.chilipiperUrl) return;
    try {
      const url = new URL(props.chilipiperUrl);
      if (fields.email) url.searchParams.set("email", fields.email);
      safeNavigate(url.toString(), "_blank");
    } catch {
      safeNavigate(props.chilipiperUrl, "_blank");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editing) return;
    setFormState("loading");
    const pageId = ctx.pageId;
    try {
      if (pageId) {
        await fetch("/api/lp/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId,
            variantId: ctx.variantId,
            fields: {
              firstName: fields.firstName,
              lastName: fields.lastName,
              email: fields.email,
              phone: fields.phone || "",
              source: "split-form-final-cta",
            },
          }),
        });
      }
    } catch {
      // Lead capture is best-effort; we still show the success state.
    }
    setFormState("success");
  };

  const inputCls =
    "w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none transition-colors focus:border-slate-400 disabled:bg-slate-50";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <section className="relative w-full overflow-hidden px-6 py-20 sm:py-28" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-20 h-80 w-80 rounded-full opacity-10 blur-3xl"
        style={{ background: `radial-gradient(circle, ${ink}, transparent 70%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: `radial-gradient(circle, ${ink}, transparent 70%)` }}
      />
      <div className="container relative z-10 mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 md:grid-cols-2">
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
          {(props.formTitle || onFieldChange) && (
            <InlineText as="h3" value={props.formTitle ?? ""} onUpdate={onFieldChange ? (v) => update("formTitle", v) : undefined} className="mb-5 text-lg font-bold text-slate-900" style={{ fontFamily: DISPLAY }} />
          )}
          {formState === "success" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}1A` }}>
                <Check className="h-6 w-6" style={{ color: accent }} />
              </div>
              <p className="text-base font-semibold text-slate-900">{props.successMessage || "Thanks — we'll be in touch shortly."}</p>
              {props.chilipiperUrl && (
                <button
                  type="button"
                  onClick={openBooking}
                  className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm"
                  style={{ backgroundColor: accent, color: onAccent }}
                >
                  <Calendar className="h-4 w-4" /> Schedule a call
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First name</label>
                  <input
                    type="text"
                    required
                    value={fields.firstName}
                    onChange={(e) => setFields((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="Jane"
                    disabled={editing}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last name</label>
                  <input
                    type="text"
                    required
                    value={fields.lastName}
                    onChange={(e) => setFields((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Smith"
                    disabled={editing}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Work email</label>
                <input
                  type="email"
                  required
                  value={fields.email}
                  onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  disabled={editing}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="tel"
                  value={fields.phone}
                  onChange={(e) => setFields((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 000-0000"
                  disabled={editing}
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={formState === "loading"}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold shadow-sm disabled:opacity-70"
                style={{ backgroundColor: accent, color: onAccent }}
              >
                {formState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : props.formButtonLabel || "Get started"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
