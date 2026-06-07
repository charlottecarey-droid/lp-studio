import React from "react";
import { Star } from "lucide-react";
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

export interface QuoteLibraryProps {
  /** Brand accent color */
  accent?: string;
  /** Text color on accent background */
  accentText?: string;
  /** Surface background color for cards */
  surface?: string;
  /** Section background color */
  bg?: string;
  /** Primary text color */
  ink?: string;
  /** Secondary text color */
  muted?: string;
  /** Border color */
  border?: string;

  /** Section eyebrow */
  eyebrow?: string;
  /** Section heading */
  heading?: string;
  /** Section subheading */
  subheading?: string;

  /** Array of testimonials to display */
  testimonials?: Testimonial[];

  /** Optional CTA configuration */
  cta?: Partial<MockupCTAProps> | null;
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    quote: "LP Studio cut our campaign time-to-market from 3 weeks to 3 hours. The quality is indistinguishable from our custom-coded pages.",
    author: "Sarah Jenkins",
    role: "VP Marketing",
    company: "Acme Corp",
    rating: 5,
    avatarInitials: "SJ",
  },
  {
    id: "2",
    quote: "Finally, a builder that actually understands B2B requirements. The built-in components are incredibly well thought out and the performance is flawless.",
    author: "Marcus Chen",
    role: "Director of Demand Gen",
    company: "TechFlow",
    rating: 5,
    avatarInitials: "MC",
  },
  {
    id: "3",
    quote: "We were skeptical about losing design control, but the brand constraints actually made our pages more consistent. Highly recommend.",
    author: "Elena Rodriguez",
    role: "CMO",
    company: "Nexus Systems",
    rating: 5,
    avatarInitials: "ER",
  },
  {
    id: "4",
    quote: "The ability to spin up bespoke ABM pages for our top accounts without waiting on engineering has transformed our outbound motion.",
    author: "David Kim",
    role: "Growth Lead",
    company: "Kira",
    rating: 5,
    avatarInitials: "DK",
  },
  {
    id: "5",
    quote: "I've tried them all. This is the first platform that feels like it was built for professional marketers who care about brand.",
    author: "Rachel Foster",
    role: "Head of Marketing",
    company: "Vanguard",
    rating: 5,
    avatarInitials: "RF",
  },
  {
    id: "6",
    quote: "Our engineering team was thrilled when we switched to LP Studio. They get to focus on the core product, and marketing gets infinite flexibility.",
    author: "Tom Baker",
    role: "CTO",
    company: "FinTech Solutions",
    rating: 4,
    avatarInitials: "TB",
  },
  {
    id: "7",
    quote: "Conversion rates are up 40% across the board because we can actually iterate and test at the speed of thought.",
    author: "Jessica Li",
    role: "Performance Marketing",
    company: "GrowthStack",
    rating: 5,
    avatarInitials: "JL",
  },
  {
    id: "8",
    quote: "The default typography and spacing are so dialed in. It's almost impossible to make an ugly page.",
    author: "Michael Rossi",
    role: "Creative Director",
    company: "DesignHaus",
    rating: 5,
    avatarInitials: "MR",
  },
  {
    id: "9",
    quote: "It just works. No weird bugs, no layout breaking on mobile, no bloated scripts slowing down the page.",
    author: "Anita Patel",
    role: "Web Strategy",
    company: "CloudScale",
    rating: 5,
    avatarInitials: "AP",
  },
];

export function QuoteLibrary({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#f8fafc", // slate-50
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Wall of Love",
  heading = "Trusted by the world's best marketing teams",
  subheading = "See what growth leaders are saying about how LP Studio transformed their go-to-market motion.",
  testimonials = DEFAULT_TESTIMONIALS,
  cta = {
    variant: "link",
    primaryLabel: "Start building for free",
    secondaryLabel: "Book a demo",
    heading: "Ready to move faster?",
    subheading: "Join 1,000+ teams shipping better pages today.",
  },
}: QuoteLibraryProps = {}) {
  return (
    <section className="w-full min-h-[800px] py-24 sm:py-32 flex flex-col items-center" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 max-w-7xl">
        
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-24 flex flex-col items-center gap-4">
          {eyebrow && (
            <span 
              className="text-sm font-bold uppercase tracking-[0.2em]"
              style={{ color: accent }}
            >
              {eyebrow}
            </span>
          )}
          {heading && (
            <h2 
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight"
              style={{ color: ink }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="text-lg md:text-xl max-w-2xl mt-2" style={{ color: muted }}>
              {subheading}
            </p>
          )}
        </div>

        {/* Masonry Grid */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {testimonials.map((t) => (
            <div 
              key={t.id}
              className="break-inside-avoid flex flex-col gap-6 p-8 rounded-2xl shadow-sm border transition-transform duration-300 hover:-translate-y-1 hover:shadow-md"
              style={{ backgroundColor: surface, borderColor: border }}
            >
              {/* Rating */}
              {t.rating && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className="w-4 h-4" 
                      style={{ 
                        fill: i < t.rating! ? accent : "transparent",
                        color: i < t.rating! ? accent : border
                      }} 
                    />
                  ))}
                </div>
              )}
              
              {/* Quote */}
              <blockquote 
                className="text-lg font-medium leading-relaxed"
                style={{ color: ink }}
              >
                "{t.quote}"
              </blockquote>
              
              {/* Author */}
              <div className="flex items-center gap-4 mt-auto pt-2">
                <div 
                  className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: `${accent}15`, color: accent }}
                >
                  {t.avatarInitials}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm" style={{ color: ink }}>{t.author}</span>
                  <span className="text-sm" style={{ color: muted }}>{t.role}, {t.company}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        {cta && (
          <div className="mt-24 pt-16 border-t" style={{ borderColor: border }}>
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
