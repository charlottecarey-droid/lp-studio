import React from "react";
import { Star, Quote } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  rating?: number;
  avatarInitials?: string;
}

export interface TestimonialGridProps {
  /** Section background color */
  bg?: string;
  /** Card background color */
  surface?: string;
  /** Border color for cards and dividers */
  border?: string;
  /** Primary text color */
  ink?: string;
  /** Secondary text color */
  muted?: string;
  /** Primary brand accent color */
  accent?: string;
  /** Text color on top of accent color */
  accentText?: string;
  /** Color for the rating stars */
  starColor?: string;

  /** Optional eyebrow text above heading */
  eyebrow?: string;
  /** Main section heading */
  heading?: string;
  /** Section subheading/description */
  subheading?: string;

  /** Array of testimonial objects */
  testimonials?: Testimonial[];

  /** Configuration for the shared CTA block at the bottom */
  cta?: MockupCTAProps | null;
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    quote: "LP Studio cut our campaign launch time from weeks to hours. It's easily the highest leverage tool in our growth stack right now.",
    author: "Sarah Jenkins",
    role: "VP Growth",
    company: "Acme Corp",
    rating: 5,
    avatarInitials: "SJ",
  },
  {
    id: "2",
    quote: "Finally, a landing page builder that doesn't feel like a toy. The design constraints actually make us faster, and the conversion rates speak for themselves.",
    author: "David Chen",
    role: "Head of Demand Gen",
    company: "Nexus",
    rating: 5,
    avatarInitials: "DC",
  },
  {
    id: "3",
    quote: "We've scaled our personalized ABM pages to 500+ without hiring a single developer. The ROI was positive in month one.",
    author: "Emily Rodriguez",
    role: "Marketing Dir",
    company: "CloudScale",
    rating: 5,
    avatarInitials: "ER",
  },
  {
    id: "4",
    quote: "The built-in testing and analytics are a game-changer. We've seen a 34% lift in form completions across all our core campaigns.",
    author: "Marcus Thorne",
    role: "Co-founder",
    company: "SendGrid",
    rating: 5,
    avatarInitials: "MT",
  },
  {
    id: "5",
    quote: "It's the first time our design team is actually happy with the output of a visual builder. Everything stays rigorously on-brand.",
    author: "Jessica Lin",
    role: "Brand Lead",
    company: "Figma",
    rating: 5,
    avatarInitials: "JL",
  },
  {
    id: "6",
    quote: "Incredible speed. We spun up an entire conference registration hub in two days. Highly recommended for any serious marketing org.",
    author: "Tom Barton",
    role: "CMO",
    company: "TechStars",
    rating: 5,
    avatarInitials: "TB",
  },
];

export function TestimonialGrid({
  bg = "#f8fafc",
  surface = "#ffffff",
  border = "#e2e8f0",
  ink = "#0f172a",
  muted = "#64748b",
  accent = "#4f46e5",
  accentText = "#ffffff",
  starColor = "#f59e0b",
  eyebrow = "Customer Stories",
  heading = "Trusted by the best marketing teams",
  subheading = "See how high-growth companies are using LP Studio to scale their campaign execution without engineering bottlenecks.",
  testimonials = DEFAULT_TESTIMONIALS,
  cta = {
    variant: "link",
    primaryLabel: "Start building for free",
    secondaryLabel: "Book a demo",
    align: "center",
  },
}: TestimonialGridProps = {}) {
  return (
    <section 
      className="w-full min-h-[820px] py-24 sm:py-32 px-6 lg:px-8 flex flex-col justify-center font-sans" 
      style={{ backgroundColor: bg }}
    >
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-16 lg:gap-20">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center gap-4 max-w-3xl mx-auto">
          {eyebrow && (
            <span 
              className="text-sm font-bold uppercase tracking-widest" 
              style={{ color: accent }}
            >
              {eyebrow}
            </span>
          )}
          {heading && (
            <h2 
              className="text-3xl md:text-5xl font-extrabold tracking-tight" 
              style={{ color: ink }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p 
              className="text-lg md:text-xl leading-relaxed mt-2" 
              style={{ color: muted }}
            >
              {subheading}
            </p>
          )}
        </div>

        {/* Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((t) => (
            <div 
              key={t.id}
              className="relative flex flex-col p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
              style={{ 
                backgroundColor: surface, 
                borderColor: border,
                boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)`
              }}
            >
              {/* Decorative Quote Watermark */}
              <Quote 
                className="absolute top-8 right-8 w-12 h-12" 
                style={{ color: border, opacity: 0.6 }} 
                strokeWidth={1}
              />

              {/* Stars */}
              {(t.rating || 5) > 0 && (
                <div className="flex items-center gap-1 mb-6 z-10" style={{ color: starColor }}>
                  {Array.from({ length: t.rating || 5 }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>
              )}

              {/* Quote Text */}
              <p 
                className="text-lg leading-relaxed mb-8 flex-1 z-10" 
                style={{ color: ink }}
              >
                "{t.quote}"
              </p>

              {/* Author Info */}
              <div className="flex items-center gap-4 mt-auto z-10 pt-4 border-t" style={{ borderColor: border }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0" style={{ backgroundColor: `${accent}1a`, color: accent }}>
                  {t.avatarInitials}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-base" style={{ color: ink }}>
                    {t.author}
                  </span>
                  <span className="text-sm font-medium" style={{ color: muted }}>
                    {t.role}, {t.company}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Optional CTA Section */}
        {cta && (
          <div className="mt-4 pt-10 border-t flex justify-center" style={{ borderColor: border }}>
            <MockupCTA 
              accent={accent}
              accentText={accentText}
              surface={surface}
              ink={ink}
              muted={muted}
              border={border}
              {...cta}
            />
          </div>
        )}

      </div>
    </section>
  );
}

export default TestimonialGrid;
