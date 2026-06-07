import React, { useState, useEffect, useRef } from "react";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  rating?: number;
  avatarInitials?: string;
  avatarImage?: string;
}

export interface QuoteCarouselProps {
  /** Primary brand color */
  accent?: string;
  /** Text/icon color that sits on top of accent */
  accentText?: string;
  /** Background color for the section */
  bg?: string;
  /** Surface color (for cards, if any) */
  surface?: string;
  /** Primary text color */
  ink?: string;
  /** Secondary text color */
  muted?: string;
  /** Border color */
  border?: string;

  /** Section eyebrow text */
  eyebrow?: string;
  /** Section heading */
  heading?: string;
  /** Section subheading */
  subheading?: string;

  /** Array of testimonials to display */
  testimonials?: Testimonial[];

  /** Optional CTA configuration to render at the bottom of the section */
  cta?: MockupCTAProps | null;
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    quote: "We went from a 3-week engineering backlog for landing pages to spinning up highly-targeted campaigns in under an hour. The conversion uplift speaks for itself, and our demand generation pipeline has never been healthier.",
    author: "Sarah Jenkins",
    role: "VP of Growth",
    company: "Lumina Data",
    avatarInitials: "SJ",
    rating: 5,
  },
  {
    quote: "Most page builders ignore enterprise constraints. This is the first platform we've found that enforces our strict brand guidelines while still giving the marketing team the agility they need to execute rapidly.",
    author: "Marcus Chen",
    role: "Head of Demand Generation",
    company: "Vertex Systems",
    avatarInitials: "MC",
    rating: 5,
  },
  {
    quote: "The ability to rapidly launch and test new messaging without developer intervention is incredible. Our overall conversion rates are up 28% because we can finally iterate at the speed of our campaigns.",
    author: "Elena Rodriguez",
    role: "Marketing Director",
    company: "Finova Capital",
    avatarInitials: "ER",
    rating: 5,
  },
];

export function QuoteCarousel({
  accent = "#4f46e5",
  accentText = "#ffffff",
  bg = "#fafafa",
  surface = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Customer Stories",
  heading = "Don't just take our word for it.",
  subheading = "See how top B2B teams are accelerating their marketing velocity and driving more pipeline.",
  testimonials = DEFAULT_TESTIMONIALS,
  cta = {
    variant: "form",
    primaryLabel: "Start your free trial",
    placeholder: "you@company.com",
    align: "center",
    heading: "Ready to accelerate your campaigns?",
    subheading: "Join 12,000+ marketers building better pages.",
  },
}: QuoteCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePrevious = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  const handleDotClick = (index: number) => {
    if (isAnimating || index === activeIndex) return;
    setIsAnimating(true);
    setActiveIndex(index);
  };

  useEffect(() => {
    if (isAnimating) {
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, 500); // matches transition duration
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isAnimating, activeIndex]);

  if (!testimonials || testimonials.length === 0) return null;

  const currentTestimonial = testimonials[activeIndex];

  return (
    <section
      className="w-full min-h-[800px] py-24 sm:py-32 flex flex-col items-center relative overflow-hidden"
      style={{ backgroundColor: bg }}
    >
      <div className="container mx-auto px-6 md:px-12 max-w-5xl flex flex-col items-center">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mb-16 sm:mb-24">
          {eyebrow && (
            <span
              className="text-sm font-bold uppercase tracking-widest mb-4 block"
              style={{ color: accent }}
            >
              {eyebrow}
            </span>
          )}
          {heading && (
            <h2
              className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6"
              style={{ color: ink }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="text-lg md:text-xl" style={{ color: muted }}>
              {subheading}
            </p>
          )}
        </div>

        {/* Carousel Area */}
        <div className="w-full relative flex items-center justify-center min-h-[360px] md:min-h-[300px]">
          
          {/* Controls - Desktop (Absolute) */}
          <button
            onClick={handlePrevious}
            className="hidden md:flex absolute left-0 md:-left-6 lg:-left-12 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full items-center justify-center border shadow-sm transition-transform hover:scale-105 z-10"
            style={{ backgroundColor: surface, borderColor: border, color: ink }}
            aria-label="Previous quote"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={handleNext}
            className="hidden md:flex absolute right-0 md:-right-6 lg:-right-12 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full items-center justify-center border shadow-sm transition-transform hover:scale-105 z-10"
            style={{ backgroundColor: surface, borderColor: border, color: ink }}
            aria-label="Next quote"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Quote Content Container */}
          <div className="relative w-full max-w-3xl overflow-hidden px-4 md:px-12 py-8">
            <div
              className={`flex flex-col items-center text-center transition-all duration-500 ease-in-out ${
                isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
            >
              <div
                className="mb-8 p-4 rounded-2xl inline-flex items-center justify-center"
                style={{ backgroundColor: `${accent}15`, color: accent }}
              >
                <Quote className="w-8 h-8 md:w-10 md:h-10" />
              </div>
              
              {/* Rating */}
              {currentTestimonial.rating && (
                <div className="flex items-center gap-1 mb-6 text-amber-400">
                  {Array.from({ length: currentTestimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>
              )}

              {/* Quote Text */}
              <blockquote
                className="text-2xl md:text-3xl lg:text-4xl font-medium leading-tight md:leading-snug mb-10"
                style={{ color: ink }}
              >
                "{currentTestimonial.quote}"
              </blockquote>

              {/* Author Info */}
              <div className="flex flex-col items-center gap-4">
                {currentTestimonial.avatarImage ? (
                  <img
                    src={currentTestimonial.avatarImage}
                    alt={currentTestimonial.author}
                    className="w-16 h-16 rounded-full object-cover border-2 shadow-sm"
                    style={{ borderColor: surface }}
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2 shadow-sm"
                    style={{
                      backgroundColor: `${accent}20`,
                      color: accent,
                      borderColor: surface,
                    }}
                  >
                    {currentTestimonial.avatarInitials || currentTestimonial.author.charAt(0)}
                  </div>
                )}
                
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold" style={{ color: ink }}>
                    {currentTestimonial.author}
                  </span>
                  <span className="text-base mt-1" style={{ color: muted }}>
                    {currentTestimonial.role}, <span className="font-semibold">{currentTestimonial.company}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls - Mobile & Dots */}
        <div className="flex items-center justify-center gap-6 mt-12 md:mt-16">
          <button
            onClick={handlePrevious}
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center border shadow-sm"
            style={{ backgroundColor: surface, borderColor: border, color: ink }}
            aria-label="Previous quote"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => handleDotClick(i)}
                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i === activeIndex ? accent : border,
                  transform: i === activeIndex ? "scale(1.2)" : "scale(1)",
                }}
                aria-label={`Go to quote ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center border shadow-sm"
            style={{ backgroundColor: surface, borderColor: border, color: ink }}
            aria-label="Next quote"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Optional CTA */}
        {cta && (
          <div className="mt-24 sm:mt-32 w-full pt-16 border-t" style={{ borderColor: border }}>
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

export default QuoteCarousel;
