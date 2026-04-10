import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyFormRightAltBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyFormRightAltBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyFormRightAltBlockProps) => void;
}

export function BlockDandyFormRightAlt({ props, brand, onFieldChange }: Props) {
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [submitted, setSubmitted] = useState(false);

  const field = (key: keyof DandyFormRightAltBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateBullet = (i: number, v: string) => {
    if (!onFieldChange) return;
    const bullets = [...(props.bullets ?? [])];
    bullets[i] = v;
    onFieldChange({ ...props, bullets });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (props.formAction) safeNavigate(props.formAction);
  };

  const bg = props.bgColor ?? "#FDFCFA";

  return (
    <section className="w-full py-20 md:py-28" style={{ backgroundColor: bg }}>
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-14 md:gap-20 items-center">

          {/* Left: headline + copy + bullets */}
          <div className="flex flex-col gap-7">
            {props.eyebrow && (
              <p className="text-xs font-bold uppercase tracking-widest text-[#006651]">
                <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
              </p>
            )}
            <h2 className="text-4xl md:text-5xl font-bold text-[#003A30] leading-[1.1] tracking-tight">
              <InlineText value={props.headline} onUpdate={field("headline")} />
            </h2>
            {props.subheadline && (
              <p className="text-lg text-slate-600 leading-relaxed">
                <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
              </p>
            )}
            {(props.bullets ?? []).length > 0 && (
              <ul className="space-y-4">
                {(props.bullets ?? []).map((b, i) => (
                  <li key={i} className="flex items-start gap-4 text-base text-slate-700">
                    <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-[#C7E738] flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-[#003A30]" />
                    </span>
                    <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined} />
                  </li>
                ))}
              </ul>
            )}
            {props.trustNote && (
              <p className="text-sm text-slate-400 mt-1">
                <InlineText value={props.trustNote} onUpdate={field("trustNote")} />
              </p>
            )}
          </div>

          {/* Right: form card */}
          <div className="bg-white rounded-3xl shadow-2xl p-10 border border-slate-100">
            {props.formHeadline && (
              <h3 className="text-2xl font-bold text-[#003A30] mb-1">
                <InlineText value={props.formHeadline} onUpdate={field("formHeadline")} />
              </h3>
            )}
            {props.formSubheadline && (
              <p className="text-sm text-slate-500 mb-7">
                <InlineText value={props.formSubheadline} onUpdate={field("formSubheadline")} />
              </p>
            )}

            {submitted ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[#C7E738] flex items-center justify-center mx-auto mb-5">
                  <Check className="w-8 h-8 text-[#003A30]" />
                </div>
                <p className="text-xl font-bold text-[#003A30]">{props.successMessage ?? "Thanks! We'll be in touch shortly."}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">First Name</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="Jane"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:border-[#003A30] transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Last Name</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Smith"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:border-[#003A30] transition-colors"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Work Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@yourpractice.com"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:border-[#003A30] transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 000-0000"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:border-[#003A30] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#C7E738] text-[#003A30] font-bold py-4 rounded-xl text-base hover:brightness-105 transition-all mt-2"
                >
                  <InlineText value={props.submitText ?? "Get a Free Demo"} onUpdate={field("submitText")} />
                </button>
                {props.formDisclaimer && (
                  <p className="text-xs text-slate-400 text-center mt-1">
                    <InlineText value={props.formDisclaimer} onUpdate={field("formDisclaimer")} />
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
