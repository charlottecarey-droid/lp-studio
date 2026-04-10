import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import type { DandyFormRightAltBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyFormRightAltBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyFormRightAltBlockProps) => void;
}

export function BlockDandyFormRightAlt({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
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
    <section className={cn("w-full", sectionPy)} style={{ backgroundColor: bg }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left: headline + copy + bullets */}
          <div className="flex flex-col gap-5">
            {props.eyebrow && (
              <p className="text-xs font-bold uppercase tracking-widest text-[#006651]">
                <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
              </p>
            )}
            <h2 className="text-3xl md:text-4xl font-bold text-[#003A30] leading-tight">
              <InlineText value={props.headline} onUpdate={field("headline")} />
            </h2>
            {props.subheadline && (
              <p className="text-base text-slate-600 leading-relaxed">
                <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
              </p>
            )}
            {(props.bullets ?? []).length > 0 && (
              <ul className="space-y-3 mt-2">
                {(props.bullets ?? []).map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-[#C7E738] flex items-center justify-center">
                      <Check className="w-3 h-3 text-[#003A30]" />
                    </span>
                    <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined} />
                  </li>
                ))}
              </ul>
            )}
            {props.trustNote && (
              <p className="text-xs text-slate-400 mt-2">
                <InlineText value={props.trustNote} onUpdate={field("trustNote")} />
              </p>
            )}
          </div>

          {/* Right: form card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            {props.formHeadline && (
              <h3 className="text-xl font-bold text-[#003A30] mb-1">
                <InlineText value={props.formHeadline} onUpdate={field("formHeadline")} />
              </h3>
            )}
            {props.formSubheadline && (
              <p className="text-sm text-slate-500 mb-6">
                <InlineText value={props.formSubheadline} onUpdate={field("formSubheadline")} />
              </p>
            )}

            {submitted ? (
              <div className="py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-[#C7E738] flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7 text-[#003A30]" />
                </div>
                <p className="text-lg font-bold text-[#003A30]">{props.successMessage ?? "Thanks! We'll be in touch shortly."}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">First Name</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="Jane"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#003A30] transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Last Name</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Smith"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#003A30] transition-colors"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Work Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@yourpractice.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#003A30] transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 000-0000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#003A30] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#C7E738] text-[#003A30] font-bold py-3.5 rounded-lg text-sm hover:brightness-105 transition-all mt-1"
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
