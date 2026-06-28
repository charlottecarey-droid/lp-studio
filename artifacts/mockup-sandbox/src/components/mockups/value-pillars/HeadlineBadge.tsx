import React from "react";
import { Zap, BarChart3, ShieldCheck } from "lucide-react";

export function HeadlineBadge() {
  const pillars = [
    {
      id: "setup",
      title: "Effortless setup",
      description: "Get started and ship in minutes. Bypass the complex engineering overhead and integrate seamlessly with your existing toolchain.",
      icon: Zap,
      color: "bg-blue-600",
      image: "/__mockup/images/headlinebox-setup.png",
      alt: "Abstract visualization of seamless integration and setup"
    },
    {
      id: "clarity",
      title: "Clarity at a glance",
      description: "Transform raw data into real-time insights. Our analytics are designed to be instantly readable, giving you the truth without the noise.",
      icon: BarChart3,
      color: "bg-emerald-600",
      image: "/__mockup/images/headlinebox-clarity.png",
      alt: "Abstract visualization of crystal clear data analytics"
    },
    {
      id: "reliability",
      title: "Reliability that scales",
      description: "Enterprise-grade dependability from day one. Built on a fault-tolerant architecture that scales effortlessly as your team grows.",
      icon: ShieldCheck,
      color: "bg-violet-600",
      image: "/__mockup/images/headlinebox-reliability.png",
      alt: "Abstract visualization of robust enterprise architecture"
    }
  ];

  return (
    <section className="py-24 bg-zinc-50 relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent" />
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-100 blur-3xl opacity-50 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <p className="text-sm font-bold tracking-widest text-indigo-600 uppercase mb-4">
            The Platform Advantage
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-zinc-900 tracking-tight mb-6">
            Built for teams that demand excellence
          </h2>
          <p className="text-lg text-zinc-600">
            Experience a platform where every detail is optimized for speed, precision, and unbreakable performance.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-10">
          {pillars.map((pillar) => (
            <div 
              key={pillar.id} 
              className="flex flex-col rounded-2xl shadow-xl shadow-zinc-200/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-zinc-200/50 transition-all duration-300 bg-white"
            >
              <div className="relative h-56 w-full rounded-t-2xl overflow-hidden bg-zinc-100">
                <img 
                  src={pillar.image} 
                  alt={pillar.alt}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>
              
              {/* The Signature Colored Box */}
              <div className={`${pillar.color} p-5 flex items-center gap-3 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none" />
                <pillar.icon className="w-6 h-6 text-white/90 relative z-10" />
                <h3 className="text-xl font-bold text-white tracking-tight relative z-10">
                  {pillar.title}
                </h3>
              </div>

              <div className="p-8 rounded-b-2xl border border-t-0 border-zinc-200 flex-1 flex flex-col">
                <p className="text-zinc-600 leading-relaxed text-base">
                  {pillar.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
