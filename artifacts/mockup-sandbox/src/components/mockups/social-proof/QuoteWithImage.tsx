import React from "react";
import { Quote, Star } from "lucide-react";
import { MockupCTA, type MockupCTAProps } from "@/components/mockups/_shared/MockupCTA";

export interface QuoteWithImageProps {
  accent?: string;
  accentText?: string;
  surface?: string;
  bg?: string;
  ink?: string;
  muted?: string;
  border?: string;
  
  eyebrow?: string;
  quote?: string;
  author?: string;
  role?: string;
  company?: string;
  imageSrc?: string;
  
  cta?: MockupCTAProps | null;
}

export function QuoteWithImage({
  accent = "#4f46e5",
  accentText = "#ffffff",
  surface = "#ffffff",
  bg = "#ffffff",
  ink = "#0f172a",
  muted = "#64748b",
  border = "#e2e8f0",
  eyebrow = "Customer Story",
  quote = "Before LP Studio, our marketing team relied on engineering for every single landing page iteration. It took weeks to test a new message. Now, we launch five high-converting, perfectly on-brand campaigns a week. It fundamentally changed how we scale demand generation.",
  author = "Sarah Jenkins",
  role = "VP of Demand Generation",
  company = "Equinox",
  imageSrc = "/__mockup/images/portrait-sarah.png",
  cta = {
    variant: "modal",
    modalKind: "booking",
    heading: "Ready to accelerate your marketing?",
    subheading: "See how LP Studio can transform your campaign velocity in a 15-minute product tour.",
    primaryLabel: "Book a personalized demo",
    align: "left"
  }
}: QuoteWithImageProps = {}) {
  return (
    <section className="w-full min-h-[800px] flex items-center justify-center py-24 sm:py-32" style={{ backgroundColor: bg }}>
      <div className="container mx-auto px-6 md:px-12 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
          
          {/* Image Side - 5 columns */}
          <div className="lg:col-span-5 relative w-full aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl transform transition-transform duration-700 hover:scale-[1.01]">
            <img 
              src={imageSrc} 
              alt={author} 
              className="absolute inset-0 w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-8 left-8 text-white">
              <p className="font-bold text-xl mb-1">{author}</p>
              <p className="text-white/80 font-medium">{role}, {company}</p>
            </div>
          </div>
          
          {/* Content Side - 7 columns */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {eyebrow && (
              <span 
                className="text-sm font-bold uppercase tracking-[0.18em] mb-8 block"
                style={{ color: accent }}
              >
                {eyebrow}
              </span>
            )}
            
            <div className="flex items-center gap-1.5 mb-8">
               {[1, 2, 3, 4, 5].map((i) => (
                 <Star key={i} className="h-5 w-5 fill-current" style={{ color: accent }} />
               ))}
            </div>

            <div className="relative">
              <Quote className="absolute -top-6 -left-8 h-16 w-16 opacity-10 transform -scale-x-100" style={{ color: ink }} />
              <h2 
                className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-relaxed tracking-tight mb-10 relative z-10" 
                style={{ color: ink }}
              >
                "{quote}"
              </h2>
            </div>
            
            <div className="h-px w-full max-w-[120px] mb-12" style={{ backgroundColor: border }} />
            
            {cta && (
              <div className="mt-4">
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

        </div>
      </div>
    </section>
  );
}

export default QuoteWithImage;
