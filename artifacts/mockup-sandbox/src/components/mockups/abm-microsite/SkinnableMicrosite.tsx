import React, { useState } from "react";
import { ArrowRight, ChevronRight, PlayCircle, BarChart3, Users, Zap, LayoutTemplate, Share2, Globe, Sparkles, MessageSquare, Briefcase, FileText } from "lucide-react";

type Skin = "cinematic" | "split";

const CONTENT = {
  hero: {
    eyebrow: "Exclusively for Vantage",
    headline: "Unlock the next era of digital experiences",
    subhead: "We've engineered a custom blueprint for Vantage to launch on-brand, personalized campaigns 75% faster than your current baseline.",
    cta: "View your blueprint"
  },
  positioning: {
    title: "The enterprise standard is shifting.",
    text: "Vantage's marketing team is producing exceptional work, but development bottlenecks are capping your revenue potential. The fastest-growing teams have decoupled creation from engineering."
  },
  whyNow: [
    { title: "Infinite Scale", text: "Launch hundreds of pages without touching a single line of code." },
    { title: "Rigid Consistency", text: "Every asset automatically adheres to Vantage's brand guidelines." },
    { title: "Deep Personalization", text: "1:1 experiences tailored to your most valuable target accounts." }
  ],
  howItWorks: [
    { title: "01. Design", text: "Start with pre-approved building blocks tailored for Vantage." },
    { title: "02. Assemble", text: "Marketing teams drag and drop to build pages in minutes." },
    { title: "03. Launch", text: "Publish instantly with enterprise-grade security and performance." }
  ],
  useCases: [
    { title: "ABM Pages", text: "Personalize the journey for high-value accounts." },
    { title: "Campaign Hubs", text: "Centralize your product launches and narratives." },
    { title: "Webinar Portals", text: "Drive registration with immersive event experiences." },
    { title: "Event Pages", text: "Capture attention before, during, and after the event." }
  ],
  proof: {
    metrics: [
      { value: "75%", label: "Faster launches" },
      { value: "3x", label: "More variations" },
      { value: "42%", label: "Engagement lift" }
    ],
    quote: "\"By removing the engineering bottleneck, we increased our campaign output by 300% in a single quarter while maintaining perfect brand consistency.\"",
    author: "Sarah Jenkins, VP Marketing",
    caseStudy: {
      title: "How Sentinel scaled their ABM motion",
      text: "Sentinel used our platform to launch 500 personalized account pages in 30 days, resulting in a 42% lift in target account engagement."
    }
  },
  resources: [
    { title: "The Vantage Blueprint", type: "Executive Summary", readTime: "5 min read" },
    { title: "ROI Calculator for Vantage", type: "Interactive Tool", readTime: "Interactive" }
  ],
  contact: {
    name: "Alex Rivera",
    role: "Strategic Account Director",
    email: "alex@lpstudio.example.com",
    message: "Ready to explore the Vantage blueprint?"
  }
};

export function SkinnableMicrosite() {
  const [skin, setSkin] = useState<Skin>("cinematic");

  return (
    <div className={`min-h-screen w-full relative transition-colors duration-500 ease-in-out font-sans ${skin === "cinematic" ? "bg-zinc-50 text-zinc-900" : "bg-[#F9F9F8] text-zinc-900"}`}>
      {/* SKIN SWITCHER */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-md shadow-sm border border-zinc-200 rounded-full p-1 flex items-center gap-1 transition-all">
        <button 
          onClick={() => setSkin("cinematic")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${skin === "cinematic" ? "bg-zinc-900 text-white shadow" : "text-zinc-500 hover:text-zinc-900"}`}
        >
          Cinematic
        </button>
        <button 
          onClick={() => setSkin("split")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${skin === "split" ? "bg-zinc-900 text-white shadow" : "text-zinc-500 hover:text-zinc-900"}`}
        >
          Split
        </button>
      </div>

      {skin === "cinematic" ? <CinematicSkin /> : <SplitSkin />}
    </div>
  );
}

function CinematicSkin() {
  return (
    <div className="animate-in fade-in duration-700">
      {/* Hero */}
      <section className="relative h-[90vh] min-h-[600px] w-full flex items-end pb-24 px-6 md:px-16 overflow-hidden">
        <div className="absolute inset-0 bg-zinc-900">
          <img src="/__mockup/images/abm-cine-hero.png" alt="Hero background" className="w-full h-full object-cover opacity-70 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
        </div>
        <div className="relative z-10 max-w-4xl text-white">
          <div className="mb-6 inline-block px-3 py-1 text-xs font-semibold tracking-wider uppercase bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
            {CONTENT.hero.eyebrow}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
            {CONTENT.hero.headline}
          </h1>
          <p className="text-xl text-zinc-300 max-w-2xl mb-10 leading-relaxed font-light">
            {CONTENT.hero.subhead}
          </p>
          <button className="bg-white text-black px-8 py-4 rounded-full font-semibold text-lg flex items-center gap-2 hover:bg-zinc-200 transition-colors">
            {CONTENT.hero.cta} <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Positioning & Why Now */}
      <section className="py-24 px-6 md:px-16 max-w-7xl mx-auto">
        <div className="max-w-3xl mb-24">
          <h2 className="text-3xl md:text-4xl font-semibold mb-6">{CONTENT.positioning.title}</h2>
          <p className="text-xl text-zinc-600 leading-relaxed">{CONTENT.positioning.text}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {CONTENT.whyNow.map((item, i) => (
            <div key={i}>
              <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mb-6 text-zinc-900">
                {i === 0 ? <Globe className="w-6 h-6" /> : i === 1 ? <LayoutTemplate className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
              </div>
              <h3 className="text-xl font-semibold mb-4">{item.title}</h3>
              <p className="text-zinc-600 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Image Band 1 */}
      <section className="w-full h-80 relative overflow-hidden">
        <img src="/__mockup/images/abm-cine-band1.png" alt="Process" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/20" />
      </section>

      {/* How it works */}
      <section className="py-24 px-6 md:px-16 bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold mb-16">The Vantage Approach</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {CONTENT.howItWorks.map((step, i) => (
              <div key={i} className="bg-white/5 p-8 rounded-2xl border border-white/10">
                <h3 className="text-xl font-semibold mb-4 text-zinc-100">{step.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="py-32 px-6 md:px-16 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold mb-12">Engineered for impact</h2>
            <div className="flex flex-col gap-12">
              {CONTENT.proof.metrics.map((metric, i) => (
                <div key={i}>
                  <div className="text-5xl md:text-6xl font-bold tracking-tight mb-2 text-zinc-900">{metric.value}</div>
                  <div className="text-xl text-zinc-500">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-zinc-100 rounded-3xl p-12">
            <Quote className="w-10 h-10 text-zinc-300 mb-8" />
            <p className="text-2xl font-medium leading-relaxed mb-8 text-zinc-900">
              {CONTENT.proof.quote}
            </p>
            <div className="text-zinc-500 font-medium">{CONTENT.proof.author}</div>
          </div>
        </div>
      </section>

      {/* Image Band 2 */}
      <section className="w-full h-96 relative overflow-hidden">
        <img src="/__mockup/images/abm-cine-band2.png" alt="Results" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <PlayCircle className="w-20 h-20 text-white/80 cursor-pointer hover:text-white transition-colors hover:scale-105 duration-300" />
        </div>
      </section>

      {/* Resources & Contact */}
      <section className="py-24 px-6 md:px-16 bg-zinc-50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20">
          <div>
            <h2 className="text-2xl font-semibold mb-8">Curated for Vantage</h2>
            <div className="flex flex-col gap-4">
              {CONTENT.resources.map((res, i) => (
                <div key={i} className="group bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all flex items-center gap-6 cursor-pointer">
                  <div className="w-24 h-24 rounded-lg bg-zinc-100 overflow-hidden shrink-0 relative">
                    <img src="/__mockup/images/abm-cine-resource.png" className="w-full h-full object-cover" alt="" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-zinc-500 mb-2">{res.type} &bull; {res.readTime}</div>
                    <h3 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">{res.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-zinc-900 text-white p-12 rounded-3xl flex flex-col justify-center">
            <h2 className="text-3xl font-semibold mb-4">{CONTENT.contact.message}</h2>
            <p className="text-zinc-400 mb-8">Connect with your dedicated strategist.</p>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-bold">AR</div>
              <div>
                <div className="font-semibold text-lg">{CONTENT.contact.name}</div>
                <div className="text-zinc-400">{CONTENT.contact.role}</div>
              </div>
            </div>
            <button className="bg-white text-black px-6 py-4 rounded-xl font-semibold w-full hover:bg-zinc-200 transition-colors">
              Book a Strategy Session
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SplitSkin() {
  return (
    <div className="animate-in fade-in duration-700 bg-white">
      {/* Hero */}
      <section className="w-full min-h-screen flex flex-col md:flex-row border-b border-zinc-200">
        <div className="w-full md:w-[55%] flex flex-col justify-center px-8 md:px-20 py-32 mt-16 md:mt-0">
          <div className="mb-8 inline-block px-3 py-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase border border-zinc-200 rounded bg-zinc-50">
            {CONTENT.hero.eyebrow}
          </div>
          <h1 className="text-5xl md:text-[5rem] font-medium tracking-tight mb-8 leading-[1.1] text-zinc-900">
            {CONTENT.hero.headline}
          </h1>
          <p className="text-xl text-zinc-600 max-w-xl mb-12 leading-relaxed font-light">
            {CONTENT.hero.subhead}
          </p>
          <div className="flex gap-4">
            <button className="border border-zinc-900 bg-white text-zinc-900 hover:bg-zinc-50 px-8 py-3 rounded text-sm font-medium tracking-wide transition-colors">
              {CONTENT.hero.cta}
            </button>
          </div>
        </div>
        <div className="w-full md:w-[45%] bg-zinc-100 min-h-[50vh] relative border-l border-zinc-200">
          <img src="/__mockup/images/abm-split-hero.png" alt="Hero visual" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </section>

      {/* Content Grid */}
      <section className="max-w-[1600px] mx-auto grid md:grid-cols-12 border-x border-zinc-200">
        
        {/* Left Col */}
        <div className="col-span-1 md:col-span-4 border-r border-zinc-200 p-8 md:p-16 flex flex-col gap-24">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-6">The Context</h2>
            <h3 className="text-2xl font-medium mb-6 text-zinc-900 leading-snug">{CONTENT.positioning.title}</h3>
            <p className="text-zinc-600 leading-relaxed font-light">{CONTENT.positioning.text}</p>
          </div>
          
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-8">Why Now</h2>
            <div className="flex flex-col gap-10">
              {CONTENT.whyNow.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="text-xs font-mono text-zinc-400 mt-1">0{i+1}</div>
                  <div>
                    <h4 className="font-medium text-zinc-900 mb-2">{item.title}</h4>
                    <p className="text-sm text-zinc-600 leading-relaxed font-light">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <img src="/__mockup/images/abm-split-whynow.png" alt="" className="w-full h-64 object-cover border border-zinc-200" />
        </div>

        {/* Right Col */}
        <div className="col-span-1 md:col-span-8 flex flex-col">
          
          {/* Top Half */}
          <div className="grid md:grid-cols-2 border-b border-zinc-200">
            <div className="p-8 md:p-16 border-r border-zinc-200 flex flex-col justify-center">
              <h2 className="text-3xl font-medium mb-12 text-zinc-900">Proven Outcomes</h2>
              <div className="grid grid-cols-2 gap-8">
                {CONTENT.proof.metrics.map((m, i) => (
                  <div key={i}>
                    <div className="text-4xl font-light text-zinc-900 mb-2">{m.value}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8 md:p-16 flex flex-col justify-center bg-zinc-50">
              <div className="text-lg font-light leading-relaxed text-zinc-700 italic mb-6">
                {CONTENT.proof.quote}
              </div>
              <div className="text-sm font-medium text-zinc-900 uppercase tracking-wider">{CONTENT.proof.author}</div>
            </div>
          </div>

          {/* Bottom Half */}
          <div className="grid md:grid-cols-2 grow">
            <div className="p-8 md:p-16 border-r border-zinc-200 relative overflow-hidden group">
              <img src="/__mockup/images/abm-split-casestudy.png" alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-white/90 group-hover:bg-white/95 transition-colors p-8 md:p-16 flex flex-col justify-between">
                <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Featured Case Study</div>
                <div>
                  <h3 className="text-2xl font-medium text-zinc-900 mb-4">{CONTENT.proof.caseStudy.title}</h3>
                  <p className="text-zinc-600 mb-8 font-light">{CONTENT.proof.caseStudy.text}</p>
                  <button className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2 text-zinc-900 group-hover:gap-3 transition-all">
                    Read Story <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-8 md:p-16 flex flex-col bg-zinc-900 text-white">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-12">Next Steps</h2>
              <div className="grow flex flex-col justify-center">
                <h3 className="text-3xl font-medium mb-8 leading-snug">{CONTENT.contact.message}</h3>
                
                <div className="flex items-center gap-6 mb-12">
                  <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border border-white/20">
                    <img src="/__mockup/images/abm-split-contact1.png" alt={CONTENT.contact.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-medium tracking-wide mb-1">{CONTENT.contact.name}</div>
                    <div className="text-sm text-zinc-400">{CONTENT.contact.role}</div>
                  </div>
                </div>

                <button className="border border-white/30 text-white hover:bg-white hover:text-black px-6 py-4 rounded text-sm font-medium tracking-wide transition-colors w-full">
                  Schedule Briefing
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>
      
      {/* Footer Line */}
      <footer className="w-full border-t border-zinc-200 py-8 text-center text-xs font-medium uppercase tracking-widest text-zinc-400">
        Confidential &bull; Prepared exclusively for Vantage
      </footer>
    </div>
  );
}

function Quote(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <path d="M14.017 18L14.017 10.609C14.017 4.905 17.748 1.039 23 0L23.995 2.151C21.563 3.068 20 5.789 20 8H24V18H14.017ZM0 18V10.609C0 4.905 3.748 1.038 9 0L9.996 2.151C7.563 3.068 6 5.789 6 8H9.983L9.983 18L0 18Z" />
    </svg>
  );
}
