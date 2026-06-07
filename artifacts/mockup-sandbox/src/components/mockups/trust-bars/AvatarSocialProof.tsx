import React from "react";
import { Star } from "lucide-react";

export function AvatarSocialProof() {
  const avatars = [
    { initials: "JD", bg: "bg-stone-200", color: "text-stone-700" },
    { initials: "AM", bg: "bg-slate-200", color: "text-slate-700" },
    { initials: "RK", bg: "bg-zinc-200", color: "text-zinc-700" },
    { initials: "EL", bg: "bg-neutral-200", color: "text-neutral-700" },
    { initials: "TC", bg: "bg-gray-200", color: "text-gray-700" },
    { initials: "SB", bg: "bg-stone-300", color: "text-stone-800" },
  ];

  return (
    <section className="w-full bg-white py-16 px-6 sm:px-12 flex flex-col items-center justify-center min-h-[480px]">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center space-y-8">
        
        {/* Avatar Stack */}
        <div className="flex -space-x-4">
          {avatars.map((avatar, i) => (
            <div
              key={i}
              className={`w-14 h-14 rounded-full flex items-center justify-center border-4 border-white ${avatar.bg} ${avatar.color} font-medium text-sm shadow-sm z-[${10 - i}] relative hover:-translate-y-1 transition-transform duration-300`}
            >
              {avatar.initials}
            </div>
          ))}
          <div className="w-14 h-14 rounded-full flex items-center justify-center border-4 border-white bg-slate-50 text-slate-600 font-semibold text-sm shadow-sm z-0 relative">
            +2k
          </div>
        </div>

        {/* Proof Text */}
        <div className="space-y-4">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            Join 12,000+ teams already growing with us
          </h2>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-slate-600">
            <div className="flex items-center gap-1 text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-5 h-5 fill-current" />
              ))}
            </div>
            <div className="h-4 w-px bg-slate-300 hidden sm:block"></div>
            <p className="text-base">
              <span className="font-medium text-slate-900">4.9/5 average</span> from 2,400+ reviews
            </p>
          </div>
        </div>

        {/* Short Testimonial */}
        <div className="pt-4 max-w-2xl">
          <p className="text-lg text-slate-500 italic">
            "We switched to Vertex and saw our team's productivity double within the first quarter. The community support is unmatched."
          </p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            — Sarah Jenkins, VP of Operations at Lumina
          </p>
        </div>

      </div>
    </section>
  );
}
