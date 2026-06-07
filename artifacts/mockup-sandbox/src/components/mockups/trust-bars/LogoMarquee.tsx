import React from "react";
import "./_group.css";

const LOGOS = [
  { name: "Northwind", icon: "N" },
  { name: "Lumina", icon: "L" },
  { name: "Vertex", icon: "V" },
  { name: "Cobalt", icon: "C" },
  { name: "Mirador", icon: "M" },
  { name: "Solstice", icon: "S" },
  { name: "Equinox", icon: "E" },
  { name: "Zenith", icon: "Z" },
];

function Logo({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 px-8 text-neutral-400 grayscale filter transition-all duration-300 hover:text-neutral-900 hover:grayscale-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 font-bold text-neutral-600 transition-colors group-hover:bg-neutral-200">
        {icon}
      </div>
      <span className="text-2xl font-bold tracking-tight">{name}</span>
    </div>
  );
}

export function LogoMarquee() {
  return (
    <section className="flex h-[480px] w-full max-w-[1280px] flex-col items-center justify-center overflow-hidden bg-white py-16">
      <div className="mb-12 flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-neutral-500">
          Trusted by 2,000+ forward-thinking teams
        </p>
      </div>

      <div className="marquee-container relative flex w-full flex-col gap-8">
        {/* Left and Right Fade Masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-white to-transparent md:w-64" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-white to-transparent md:w-64" />

        {/* Top Row - Scrolling Left */}
        <div className="group flex overflow-hidden">
          <div className="animate-marquee flex min-w-full shrink-0 items-center gap-12">
            {LOGOS.map((logo, i) => (
              <Logo key={`top-1-${i}`} {...logo} />
            ))}
          </div>
          <div aria-hidden="true" className="animate-marquee flex min-w-full shrink-0 items-center gap-12">
            {LOGOS.map((logo, i) => (
              <Logo key={`top-2-${i}`} {...logo} />
            ))}
          </div>
        </div>

        {/* Bottom Row - Scrolling Right */}
        <div className="group flex overflow-hidden">
          {/* We use negative margin or flex order, but simply having the animation start at -100% works */}
          <div className="animate-marquee-reverse flex min-w-full shrink-0 items-center gap-12">
            {[...LOGOS].reverse().map((logo, i) => (
              <Logo key={`bottom-1-${i}`} {...logo} />
            ))}
          </div>
          <div aria-hidden="true" className="animate-marquee-reverse flex min-w-full shrink-0 items-center gap-12">
            {[...LOGOS].reverse().map((logo, i) => (
              <Logo key={`bottom-2-${i}`} {...logo} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
