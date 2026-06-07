import React from 'react';

const logos = [
  {
    name: "Northwind",
    svg: (
      <svg viewBox="0 0 130 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 md:h-8">
        <path d="M15 12 L25 28 L5 28 Z" fill="currentColor"/>
        <text x="35" y="26" fill="currentColor" fontSize="18" fontWeight="600" fontFamily="serif" letterSpacing="-0.02em">Northwind</text>
      </svg>
    )
  },
  {
    name: "Lumina",
    svg: (
      <svg viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 md:h-7">
        <circle cx="15" cy="20" r="7" stroke="currentColor" strokeWidth="2.5"/>
        <text x="32" y="26" fill="currentColor" fontSize="18" fontWeight="400" fontFamily="sans-serif" letterSpacing="0.06em">LUMINA</text>
      </svg>
    )
  },
  {
    name: "Vertex",
    svg: (
      <svg viewBox="0 0 110 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 md:h-7">
        <path d="M10 28 L20 12 L30 28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/>
        <text x="38" y="26" fill="currentColor" fontSize="18" fontWeight="700" fontFamily="sans-serif" letterSpacing="-0.01em">VERTEX</text>
      </svg>
    )
  },
  {
    name: "Cobalt",
    svg: (
      <svg viewBox="0 0 110 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 md:h-8">
        <rect x="10" y="12" width="14" height="14" fill="currentColor"/>
        <text x="34" y="26" fill="currentColor" fontSize="18" fontWeight="500" fontFamily="sans-serif" letterSpacing="0.02em">Cobalt</text>
      </svg>
    )
  },
  {
    name: "Mirador",
    svg: (
      <svg viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 md:h-8">
        <path d="M10 20 Q 15 12 20 20 T 30 20" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <text x="38" y="26" fill="currentColor" fontSize="19" fontWeight="300" fontFamily="serif" fontStyle="italic">Mirador</text>
      </svg>
    )
  }
];

export function LogoWall() {
  return (
    <section className="w-full bg-white py-16 md:py-24 px-6 md:px-12 flex flex-col items-center justify-center">
      <div className="max-w-6xl mx-auto w-full flex flex-col items-center gap-10 md:gap-14">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-[0.2em] text-center">
          Trusted by teams at
        </h2>
        
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-10 md:gap-x-24 md:gap-y-12">
          {logos.map((logo) => (
            <div 
              key={logo.name} 
              className="text-slate-400 transition-colors duration-300 hover:text-slate-900 flex items-center justify-center"
              aria-label={logo.name}
            >
              {logo.svg}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
