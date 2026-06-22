import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Play, FileText, Check, Plus } from 'lucide-react';
import './_atelier.css';

export function Atelier() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="atelier-variant min-h-screen selection:bg-terracotta/20 selection:text-ink">
      
      {/* 1. Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 border-b border-transparent ${scrolled ? 'bg-ivory/80 backdrop-blur-xl border-ink-10 py-5' : 'py-8'}`}>
        <div className="px-8 md:px-16 flex items-center justify-between">
          <div className="font-serif text-2xl tracking-wide text-ink cursor-pointer hover:opacity-70 transition-opacity">
            LP STUDIO
          </div>
          
          <nav className="hidden lg:flex items-center gap-12 text-[11px] uppercase tracking-[0.2em] font-medium text-ink-light">
            <a href="#brief" className="hover:text-ink transition-colors">The Brief</a>
            <a href="#methodology" className="hover:text-ink transition-colors">Methodology</a>
            <a href="#impact" className="hover:text-ink transition-colors">Impact</a>
            <a href="#action" className="hover:text-ink transition-colors">Action</a>
          </nav>

          <div className="flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-medium">
            <button className="text-ink hover:text-terracotta transition-colors hidden md:block">
              Client Portal
            </button>
          </div>
        </div>
      </header>

      {/* 2. Personalized Hero & Brief */}
      <section className="pt-48 pb-32 px-8 md:px-16 flex flex-col xl:flex-row items-end gap-16 lg:gap-24 max-w-[1600px] mx-auto">
        <div className="xl:w-2/3 slow-reveal">
          <p className="text-[11px] uppercase tracking-[0.3em] text-terracotta mb-8 font-medium">Strategic Brief // Prepared for Vantage</p>
          <h1 className="text-6xl md:text-8xl lg:text-[7rem] font-serif leading-[0.95] text-ink mb-12">
            The architecture <br/>
            <span className="italic font-light">of engagement.</span>
          </h1>
          <div className="flex items-center gap-6">
            <div className="h-[1px] w-16 bg-ink-20 hidden md:block"></div>
            <p className="text-lg text-ink-light font-light leading-relaxed max-w-xl">
              As your marketing shifts toward higher-touch ABM, the bottleneck is no longer data—it's content creation. A governed approach for launching bespoke campaigns in minutes.
            </p>
          </div>
        </div>

        <div className="xl:w-1/3 w-full slow-reveal delay-200">
          <div className="border border-ink-10 p-10 bg-ivory">
            <h3 className="font-serif text-3xl mb-10 text-ink">Account Spec</h3>
            <div className="space-y-6 text-sm">
              <div className="flex justify-between items-end hairline-b pb-4">
                <span className="text-ink-light font-medium text-xs tracking-wider uppercase">Target</span>
                <span className="text-ink text-right font-serif text-lg">Vantage</span>
              </div>
              <div className="flex justify-between items-end hairline-b pb-4">
                <span className="text-ink-light font-medium text-xs tracking-wider uppercase">Profile</span>
                <span className="text-ink text-right">B2B SaaS / Enterprise</span>
              </div>
              <div className="flex justify-between items-end hairline-b pb-4">
                <span className="text-ink-light font-medium text-xs tracking-wider uppercase">Audience</span>
                <span className="text-ink text-right">Marketing Leadership</span>
              </div>
              <div className="flex justify-between items-end hairline-b pb-4">
                <span className="text-ink-light font-medium text-xs tracking-wider uppercase">Status</span>
                <span className="text-ink text-right flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-terracotta"></div>
                  Engaged
                </span>
              </div>
              <div className="flex justify-between items-end pt-2">
                <span className="text-ink-light font-medium text-xs tracking-wider uppercase">Studio Reps</span>
                <span className="text-ink text-right font-serif italic">JM, PS, ML</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Image Full Bleed */}
      <section className="w-full px-8 md:px-16 pb-32 max-w-[1600px] mx-auto">
        <div className="w-full aspect-[21/9] bg-stone relative overflow-hidden slow-reveal delay-300">
          <img src="/__mockup/images/abm-atelier-hero.png" alt="Interior Architecture" className="w-full h-full object-cover mix-blend-multiply opacity-90" />
        </div>
      </section>

      {/* 3. Why this matters now */}
      <section id="brief" className="py-32 bg-stone text-ink">
        <div className="px-8 md:px-16 max-w-[1600px] mx-auto">
          <div className="grid lg:grid-cols-12 gap-16 lg:gap-24 mb-24">
            <div className="lg:col-span-5">
              <h2 className="text-5xl md:text-6xl font-serif leading-[1.1]">
                The friction in<br/>modern GTM.
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 pt-4">
              <p className="text-xl font-light leading-relaxed opacity-80">
                Scaling personalization historically required compromising on quality or overwhelming your engineering teams. The sheer volume of pages outpaces traditional CMS capabilities, extending time-to-market and diluting brand integrity.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-12 hairline-t pt-16">
            {[
              { num: "01", title: "Volume", desc: "As go-to-market strategies become granular, the number of pages required outpaces CMS capabilities." },
              { num: "02", title: "Consistency", desc: "When creation is decentralized, keeping the brand premium and unified becomes incredibly difficult." },
              { num: "03", title: "Bottlenecks", desc: "High-value campaigns sit idle waiting for engineering or design resources, reducing agility." }
            ].map((item, i) => (
              <div key={i} className="group">
                <span className="text-[10px] font-medium tracking-[0.2em] opacity-40 mb-6 block">{item.num}</span>
                <h3 className="font-serif text-3xl mb-4">{item.title}</h3>
                <p className="font-light text-sm opacity-70 leading-relaxed max-w-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Methodology / Approach */}
      <section id="methodology" className="py-40 bg-ivory">
        <div className="px-8 md:px-16 max-w-[1600px] mx-auto">
          <div className="text-center mb-32 max-w-3xl mx-auto">
            <span className="text-[11px] tracking-[0.3em] uppercase text-terracotta mb-6 block font-medium">The Methodology</span>
            <h2 className="text-5xl md:text-6xl font-serif leading-[1.1] text-ink">
              Governed autonomy for revenue teams.
            </h2>
          </div>

          <div className="flex flex-col lg:flex-row gap-0 border border-ink-10">
            {[
              { title: "Governed Templates", desc: "Design provides approved, on-brand foundational templates that revenue teams can safely access." },
              { title: "Targeted Personalization", desc: "Marketers customize content, messaging, and modules for the specific account, audience, and stage." },
              { title: "Connected Deployment", desc: "Deploy instantly and track deep engagement metrics directly back to your CRM." }
            ].map((step, i) => (
              <div key={i} className="flex-1 p-12 lg:p-16 relative group border-b lg:border-b-0 lg:border-r border-ink-10 last:border-0 hover:bg-stone/30 transition-colors duration-500">
                <div className="text-[10px] font-medium tracking-[0.2em] text-terracotta mb-16">PHASE {i+1}</div>
                <h3 className="font-serif text-3xl mb-6">{step.title}</h3>
                <p className="text-ink-light text-sm font-light leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Use Cases & Value */}
      <section className="py-40 bg-ink text-ivory">
        <div className="px-8 md:px-16 max-w-[1600px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-24 lg:gap-32">
            
            <div>
              <div className="sticky top-40">
                <span className="text-[11px] tracking-[0.3em] uppercase text-terracotta mb-8 block font-medium">Value Realized</span>
                <h2 className="text-6xl md:text-7xl font-serif leading-[1.05] mb-12">
                  Campaign-ready<br/>in minutes.
                </h2>
                <p className="text-lg font-light leading-relaxed text-ivory/60 mb-16 max-w-md">
                  By uncoupling content assembly from development, your team can leverage content reuse, ship faster, and maintain strict brand compliance.
                </p>
                
                <div className="aspect-[3/4] max-w-sm bg-ink relative overflow-hidden">
                  <img src="/__mockup/images/abm-atelier-still.png" alt="Still Life" className="w-full h-full object-cover opacity-80" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-12 pt-8">
              {[
                { title: "ABM Account Pages", team: "Field Marketing", desc: "Dedicated 1:1 hubs for top-tier accounts like Vantage, bringing together personalized videos, case studies, and exact pricing structures." },
                { title: "Webinar & Event Hubs", team: "Demand Gen", desc: "Pre and post-event experiences that house registration, speaker bios, on-demand recordings, and follow-up collateral in one seamless journey." },
                { title: "Campaign Landing Pages", team: "Performance", desc: "High-converting destination pages for specific ad groups or outbound sequences, spun up without touching the core CMS." },
                { title: "Content Hubs", team: "Content", desc: "Curated collections of thought leadership tailored to a specific vertical or buyer persona, designed for binge-consumption." }
              ].map((useCase, i) => (
                <div key={i} className="group border-b border-ivory/10 pb-12 cursor-pointer">
                  <div className="flex items-center gap-6 mb-6">
                    <h3 className="font-serif text-4xl text-ivory group-hover:text-terracotta transition-colors">{useCase.title}</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-ivory/50 font-light text-sm max-w-sm leading-relaxed">{useCase.desc}</p>
                    <div className="w-12 h-12 rounded-full border border-ivory/20 flex items-center justify-center group-hover:border-terracotta transition-colors">
                      <ArrowUpRight className="w-5 h-5 text-ivory/50 group-hover:text-terracotta" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* 6. Proof */}
      <section id="impact" className="py-40 bg-stone">
        <div className="px-8 md:px-16 max-w-[1600px] mx-auto">
          <div className="mb-24 flex justify-between items-end">
            <h2 className="text-5xl font-serif text-ink leading-tight">Measurable Impact</h2>
            <p className="text-ink-light max-w-sm text-sm font-light">Performance metrics observed across enterprise deployments within the first two quarters.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-24">
            <div className="bg-ivory p-12 flex flex-col justify-between aspect-square">
              <div className="text-7xl font-serif text-ink">75<span className="text-terracotta font-sans text-5xl">%</span></div>
              <p className="text-ink-light text-sm uppercase tracking-widest font-medium">Faster page launches</p>
            </div>
            <div className="bg-ink p-12 flex flex-col justify-between aspect-square text-ivory">
              <div className="text-7xl font-serif">3<span className="text-terracotta font-sans text-5xl">x</span></div>
              <p className="text-ivory/60 text-sm uppercase tracking-widest font-medium">More campaign variations</p>
            </div>
            <div className="bg-ivory p-12 flex flex-col justify-between aspect-square">
              <div className="text-7xl font-serif text-ink">42<span className="text-terracotta font-sans text-5xl">%</span></div>
              <p className="text-ink-light text-sm uppercase tracking-widest font-medium">Increased engagement</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="border-l border-terracotta pl-10">
              <p className="text-3xl lg:text-4xl font-serif leading-[1.2] text-ink mb-12">
                "LP Studio fundamentally changed how we go to market. We no longer wait weeks for design. We just build, personalize, and ship."
              </p>
              <div className="text-sm">
                <div className="font-medium text-ink uppercase tracking-widest mb-1">Elena Higgins</div>
                <div className="text-ink-light font-light">VP Marketing, Enterprise SaaS</div>
              </div>
            </div>
            <div className="w-full aspect-video bg-ink relative flex items-center justify-center cursor-pointer group overflow-hidden">
              <img src="/__mockup/images/abm-atelier-office.png" alt="Office" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity group-hover:scale-105 transition-transform duration-1000" />
              <div className="w-20 h-20 bg-ivory rounded-full flex items-center justify-center relative z-10 group-hover:bg-terracotta transition-colors duration-500">
                <Play className="w-6 h-6 text-ink ml-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Mutual Action & Resources */}
      <section id="action" className="py-40 bg-ivory">
        <div className="px-8 md:px-16 max-w-[1600px] mx-auto grid xl:grid-cols-2 gap-32">
          
          {/* Mutual Action Plan */}
          <div>
            <h2 className="text-4xl font-serif mb-16 text-ink">Evaluation Protocol</h2>
            <div className="border border-ink-10">
              {[
                { title: "Confirm ABM goals & metrics", owner: "Joint", status: "completed" },
                { title: "Review bespoke strategy brief", owner: "Vantage", status: "current" },
                { title: "Select pilot campaign use case", owner: "Vantage", status: "upcoming" },
                { title: "Technical & integration review", owner: "LP Studio SC", status: "upcoming" }
              ].map((step, i) => (
                <div key={i} className="flex items-center justify-between p-8 border-b border-ink-10 last:border-b-0 bg-white/50">
                  <div className="flex items-center gap-6">
                    <div className="text-[10px] font-medium tracking-[0.2em] text-ink-light w-8">0{i+1}</div>
                    <h4 className={`font-serif text-2xl ${step.status === 'upcoming' ? 'text-ink-light' : 'text-ink'}`}>{step.title}</h4>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[10px] uppercase tracking-widest text-ink-light">{step.owner}</span>
                    <div className="w-6 h-6 flex items-center justify-center">
                      {step.status === 'completed' && <Check className="w-4 h-4 text-ink" />}
                      {step.status === 'current' && <div className="w-2 h-2 bg-terracotta rounded-full"></div>}
                      {step.status === 'upcoming' && <div className="w-1.5 h-1.5 bg-ink-20 rounded-full"></div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dedicated Team */}
          <div>
            <h2 className="text-4xl font-serif mb-16 text-ink">The Vantage Team</h2>
            <div className="space-y-12">
              {[
                { initials: "JM", name: "Jordan Mills", role: "Account Executive" },
                { initials: "ML", name: "Marcus Lee", role: "Solutions Consultant" },
                { initials: "PS", name: "Priya Sharma", role: "Customer Success" }
              ].map((member, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-8">
                    <div className="w-16 h-16 rounded-full border border-ink-20 flex items-center justify-center font-serif italic text-xl text-ink">
                      {member.initials}
                    </div>
                    <div>
                      <h4 className="font-serif text-2xl text-ink mb-1">{member.name}</h4>
                      <p className="text-sm text-ink-light font-light">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-[10px] uppercase tracking-widest font-medium border border-ink-20 px-4 py-2 hover:bg-ink hover:text-ivory transition-colors">
                      Email
                    </button>
                    <button className="text-[10px] uppercase tracking-widest font-medium border border-ink-20 px-4 py-2 hover:bg-ink hover:text-ivory transition-colors">
                      Book
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-20 pt-12 hairline-t">
              <h4 className="text-[11px] tracking-[0.2em] uppercase font-medium text-ink mb-6">Curated Resources</h4>
              <div className="flex flex-col gap-4">
                {['The Enterprise Guide to ABM Content', 'Live ABM Hub Showcase', 'State of Personalization 2024'].map((res, i) => (
                  <a key={i} href="#" className="flex items-center justify-between text-sm text-ink-light hover:text-terracotta transition-colors py-2">
                    <span className="font-light">{res}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="py-32 bg-ink text-center border-t border-ivory/10">
        <h2 className="text-5xl md:text-7xl font-serif text-ivory mb-12">Proceed with intent.</h2>
        <button className="bg-ivory text-ink px-12 py-5 text-[11px] uppercase tracking-[0.3em] font-medium hover:bg-terracotta hover:text-ivory transition-colors duration-500">
          Schedule Briefing
        </button>
      </footer>
    </div>
  );
}
