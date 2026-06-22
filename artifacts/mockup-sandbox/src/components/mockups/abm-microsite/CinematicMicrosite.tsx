import React from "react";
import { ArrowRight, Check, PlayCircle, BarChart3, Users, Zap } from "lucide-react";

export function CinematicMicrosite() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-900 selection:text-white pb-24">
      {/* Navigation (implied, subtle) */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-8 py-6 flex items-center justify-between text-white/90">
        <div className="text-xl font-medium tracking-tight">LP Studio</div>
        <div className="hidden md:flex space-x-8 text-sm font-medium">
          <a href="#shift" className="hover:text-white transition-colors">The Shift</a>
          <a href="#approach" className="hover:text-white transition-colors">Approach</a>
          <a href="#impact" className="hover:text-white transition-colors">Impact</a>
        </div>
      </nav>

      {/* Hero: Full Bleed Image */}
      <section className="relative h-[90vh] min-h-[600px] flex flex-col justify-end pb-24 px-8 md:px-16 overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="/__mockup/images/abm-cine-hero.png" 
            alt="Hero Architecture" 
            className="w-full h-full object-cover"
          />
          {/* Gradient Scrim for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/40 to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-4xl text-white">
          <p className="text-stone-300 font-medium tracking-widest uppercase text-sm mb-6 flex items-center">
            <span className="w-8 h-[1px] bg-stone-300 mr-4"></span>
            Exclusively for Vantage
          </p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
            Launch campaign pages at the speed of your revenue team.
          </h1>
          <p className="text-xl md:text-2xl text-stone-300 mb-10 max-w-2xl leading-relaxed">
            Eliminate the design bottleneck. Equip your marketing team to ship high-converting, on-brand experiences in minutes, not weeks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="bg-white text-stone-900 px-8 py-4 rounded-none font-semibold hover:bg-stone-200 transition-colors inline-flex items-center justify-center">
              Explore the Solution <ArrowRight className="ml-2 w-5 h-5" />
            </button>
            <button className="bg-transparent border border-white/30 text-white px-8 py-4 rounded-none font-semibold hover:bg-white/10 transition-colors inline-flex items-center justify-center">
              Watch 2-Min Demo <PlayCircle className="ml-2 w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Positioning / Value Statement */}
      <section className="py-32 px-8 md:px-16 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-semibold leading-tight text-stone-800">
          Vantage's go-to-market motion is scaling, but web execution is slowing you down. It doesn't have to be this way.
        </h2>
      </section>

      {/* Full-width image band */}
      <section className="h-[40vh] min-h-[400px] w-full relative">
        <img 
          src="/__mockup/images/abm-cine-band1.png" 
          alt="Abstract dark texture" 
          className="w-full h-full object-cover"
        />
      </section>

      {/* "Why Now" / Shift */}
      <section id="shift" className="py-32 px-8 md:px-16 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32 items-center">
        <div>
          <p className="text-stone-500 font-medium tracking-widest uppercase text-sm mb-6">The Opportunity</p>
          <h3 className="text-4xl font-bold mb-8 text-stone-900 leading-tight">Move from rigid templates to modular storytelling.</h3>
          <p className="text-lg text-stone-600 mb-6 leading-relaxed">
            Modern B2B buying demands personalized, relevant experiences. But when every new landing page requires an IT ticket or a design sprint, personalization becomes impossible to scale.
          </p>
          <p className="text-lg text-stone-600 leading-relaxed">
            LP Studio decentralizes web creation while strictly enforcing brand governance. Your revenue team gets the agility they need; your brand team gets the control they require.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white p-8 border border-stone-200 shadow-sm">
            <BarChart3 className="w-8 h-8 text-stone-900 mb-6" />
            <h4 className="text-xl font-bold mb-3 text-stone-900">Campaign Velocity</h4>
            <p className="text-stone-600">Launch targeted campaigns the same day the idea is formed, capturing market momentum.</p>
          </div>
          <div className="bg-stone-900 p-8 text-white shadow-xl translate-x-0 md:-translate-x-8">
            <Users className="w-8 h-8 text-stone-300 mb-6" />
            <h4 className="text-xl font-bold mb-3">1:1 Personalization</h4>
            <p className="text-stone-300">Deploy account-specific microsites that speak directly to enterprise buyers' unique challenges.</p>
          </div>
          <div className="bg-white p-8 border border-stone-200 shadow-sm">
            <Zap className="w-8 h-8 text-stone-900 mb-6" />
            <h4 className="text-xl font-bold mb-3 text-stone-900">Conversion Focus</h4>
            <p className="text-stone-600">Iterate rapidly on messaging and layout to optimize conversion rates without code.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="approach" className="py-32 bg-stone-200 px-8 md:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h3 className="text-4xl font-bold text-stone-900 mb-6">The LP Studio Approach</h3>
            <p className="text-xl text-stone-600 max-w-2xl">A systematic way to scale your digital presence.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="text-7xl font-bold text-stone-300 mb-8">01</div>
              <h4 className="text-2xl font-bold mb-4 text-stone-900">Codify Your Brand</h4>
              <p className="text-stone-600 leading-relaxed">
                We ingest your exact typography, color palettes, and component styles. The system ensures every page generated is mathematically on-brand.
              </p>
            </div>
            <div>
              <div className="text-7xl font-bold text-stone-300 mb-8">02</div>
              <h4 className="text-2xl font-bold mb-4 text-stone-900">Empower the Team</h4>
              <p className="text-stone-600 leading-relaxed">
                Marketing and sales teams assemble pages using approved blocks. No dragging elements around a freeform canvas; just clean, structured content entry.
              </p>
            </div>
            <div>
              <div className="text-7xl font-bold text-stone-300 mb-8">03</div>
              <h4 className="text-2xl font-bold mb-4 text-stone-900">Publish & Iterate</h4>
              <p className="text-stone-600 leading-relaxed">
                Deploy instantly to your domain. Measure engagement, swap components, and test new messaging in real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What you can do (Filled Cards) */}
      <section className="py-32 px-8 md:px-16 max-w-7xl mx-auto">
        <div className="mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <h3 className="text-4xl font-bold text-stone-900 mb-6">Everything you need to go to market.</h3>
            <p className="text-xl text-stone-600">Purpose-built structures for every revenue scenario.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "ABM Microsites", desc: "1:1 account destinations that close enterprise deals." },
            { title: "Campaign Hubs", desc: "Multi-asset destinations for global product launches." },
            { title: "Event Pages", desc: "High-converting registration flows for field marketing." },
            { title: "Partner Portals", desc: "Co-branded resource centers for your channel ecosystem." }
          ].map((useCase, idx) => (
            <div key={idx} className="bg-stone-900 text-white p-10 flex flex-col h-full hover:-translate-y-2 transition-transform duration-300">
              <h4 className="text-xl font-bold mb-4">{useCase.title}</h4>
              <p className="text-stone-400 mt-auto">{useCase.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Second Image Band */}
      <section className="h-[60vh] min-h-[500px] w-full relative">
        <img 
          src="/__mockup/images/abm-cine-band2.png" 
          alt="Meeting room candid" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-stone-900/30"></div>
      </section>

      {/* Proof / Outcomes */}
      <section id="impact" className="py-32 px-8 md:px-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div>
            <div className="mb-16">
              <h3 className="text-8xl font-bold text-stone-900 mb-2">75<span className="text-6xl text-stone-400">%</span></h3>
              <p className="text-xl font-medium text-stone-600 uppercase tracking-wide">Faster time to market</p>
            </div>
            <div className="mb-16">
              <h3 className="text-8xl font-bold text-stone-900 mb-2">3<span className="text-6xl text-stone-400">x</span></h3>
              <p className="text-xl font-medium text-stone-600 uppercase tracking-wide">More campaigns launched</p>
            </div>
            <div>
              <h3 className="text-8xl font-bold text-stone-900 mb-2">42<span className="text-6xl text-stone-400">%</span></h3>
              <p className="text-xl font-medium text-stone-600 uppercase tracking-wide">Increase in engagement</p>
            </div>
          </div>
          
          <div className="bg-stone-100 p-12 md:p-16 border-l-4 border-stone-900">
            <p className="text-2xl md:text-3xl font-medium text-stone-800 leading-snug mb-10">
              "LP Studio completely transformed how we interface with our target accounts. We no longer send static PDFs; we send immersive, personalized web experiences that our buyers actually want to read."
            </p>
            <div>
              <p className="font-bold text-stone-900">Sarah Jenkins</p>
              <p className="text-stone-500">VP of Revenue Marketing, GlobalCorp</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recommended Resources */}
      <section className="py-24 bg-stone-900 text-white px-8 md:px-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h3 className="text-3xl font-bold mb-6">Further Reading</h3>
            <p className="text-stone-400 text-lg mb-10">Dive deeper into how top-performing revenue teams are structuring their digital GTM.</p>
            
            <div className="space-y-6">
              <a href="#" className="block group border-b border-stone-800 pb-6">
                <p className="text-stone-400 text-sm mb-2 uppercase tracking-wider">Case Study</p>
                <h4 className="text-xl font-bold group-hover:text-stone-300 transition-colors flex items-center justify-between">
                  How TechFlow scaled ABM to 500 accounts <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h4>
              </a>
              <a href="#" className="block group border-b border-stone-800 pb-6">
                <p className="text-stone-400 text-sm mb-2 uppercase tracking-wider">Guide</p>
                <h4 className="text-xl font-bold group-hover:text-stone-300 transition-colors flex items-center justify-between">
                  The Blueprint for High-Converting Campaign Pages <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h4>
              </a>
            </div>
          </div>
          <div className="hidden md:block h-[400px]">
            <img 
              src="/__mockup/images/abm-cine-resource.png" 
              alt="Resource preview" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Next Step / Contact */}
      <section className="py-32 px-8 md:px-16 max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-8">Let's discuss Vantage's strategy.</h2>
        <p className="text-xl text-stone-600 mb-12 leading-relaxed">
          I've put together a few ideas on how we can accelerate your campaign velocity specifically for the upcoming Q3 product launch.
        </p>
        
        <div className="inline-block text-left bg-white border border-stone-200 p-8 shadow-md">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-stone-300 rounded-full flex-shrink-0">
              <img src="https://ui-avatars.com/api/?name=Marcus+T&background=292524&color=fff&size=160" alt="Marcus T" className="w-full h-full rounded-full" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-stone-900">Marcus T.</h4>
              <p className="text-stone-500">Enterprise Director, LP Studio</p>
            </div>
          </div>
          <button className="w-full bg-stone-900 text-white px-8 py-4 rounded-none font-semibold hover:bg-stone-800 transition-colors text-center">
            Schedule a Strategy Call
          </button>
        </div>
      </section>
    </div>
  );
}
