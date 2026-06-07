import React from "react";
import { Quote } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface SingleQuoteTestimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatarInitials?: string;
}

export interface SingleQuoteProps {
  /** Background color for the section. */
  bg?: string;
  /** Primary brand color for accents (quote mark, CTA, etc). */
  accent?: string;
  /** Text color on top of the accent color. */
  accentText?: string;
  /** Background color for cards/surfaces (like the CTA modal). */
  surface?: string;
  /** Primary text color. */
  ink?: string;
  /** Secondary text color. */
  muted?: string;
  /** Border color. */
  border?: string;

  testimonial?: SingleQuoteTestimonial;
  cta?: MockupCTAProps | null;
}

const defaultTestimonial: SingleQuoteTestimonial = {
  quote: "Before LP Studio, every campaign required a week of dev time just to get the tracking and styling right. Now, my demand gen team launches six flawless, brand-perfect pages a week on their own. It has fundamentally changed our velocity.",
  author: "Sarah Jenkins",
  role: "VP of Growth Marketing",
  company: "Acme Corp",
  avatarInitials: "SJ",
};

const defaultCta: MockupCTAProps = {
  variant: "modal",
  modalKind: "form",
  primaryLabel: "Start your free trial",
  heading: "Ready to scale your campaigns?",
  subheading: "Join 10,000+ marketers building better pages.",
};

export function SingleQuote({
  bg = "#ffffff",
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  testimonial = defaultTestimonial,
  cta = defaultCta,
}: SingleQuoteProps = {}) {
  return (
    <section
      className="relative flex min-h-[720px] w-full flex-col items-center justify-center overflow-hidden px-6 py-24 sm:px-12 md:py-32"
      style={{ backgroundColor: bg }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center text-center">
        {/* Large Quote Mark */}
        <div className="mb-10 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 transition-transform hover:scale-105 duration-300">
          <Quote className="h-10 w-10" style={{ color: accent }} />
        </div>

        {/* Cinematic Quote */}
        <blockquote className="mb-12 max-w-4xl text-3xl font-medium leading-snug tracking-tight sm:text-4xl md:text-5xl md:leading-tight">
          <span style={{ color: ink }}>&ldquo;{testimonial.quote}&rdquo;</span>
        </blockquote>

        {/* Author Info */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold tracking-tight shadow-sm"
            style={{ backgroundColor: accent, color: accentText }}
          >
            {testimonial.avatarInitials}
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold" style={{ color: ink }}>
              {testimonial.author}
            </span>
            <span className="text-base" style={{ color: muted }}>
              {testimonial.role},{" "}
              <span className="font-medium" style={{ color: ink }}>
                {testimonial.company}
              </span>
            </span>
          </div>
        </div>

        {/* Divider */}
        {cta && (
          <div className="mt-20 flex w-full flex-col items-center pt-20">
            <div
              className="mb-20 h-px w-full max-w-md"
              style={{ backgroundColor: border }}
            />
            <MockupCTA
              {...cta}
              accent={accent}
              accentText={accentText}
              surface={surface}
              ink={ink}
              muted={muted}
              border={border}
            />
          </div>
        )}
      </div>
    </section>
  );
}
