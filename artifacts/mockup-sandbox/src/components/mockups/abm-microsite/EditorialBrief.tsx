import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, PlayCircle, Quote, Circle, CheckCircle2, Briefcase } from 'lucide-react';
import './_editorial.css';

export function EditorialBrief() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="editorial-brief min-h-screen selection:bg-accent/20 selection:text-ink">
      {/* 1. Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 border-b border-transparent ${scrolled ? 'bg-paper/95 backdrop-blur-sm border-ink-10 py-4' : 'py-8'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer">
            <span className="font-serif italic text-2xl font-bold text-ink">LP Studio</span>
            <div className="h-4 w-px bg-ink-20"></div>
            <span className="text-xs uppercase tracking-widest text-ink-light">Client Dossier</span>
          </div>
          
          <nav className="hidden lg:flex items-center gap-10 text-xs font-sans uppercase tracking-[0.15em] text-ink-light">
            {['Overview', 'Methodology', 'Use Cases', 'Evidence', 'Action Plan'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} className="hover:text-ink transition-colors">
                {item}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* 2. Personalized Hero & Brief Panel */}
      <section id="overview" className="pt-48 pb-32 px-6 md:px-12 max-w-7xl mx-auto flex flex-col lg:flex-row gap-20 items-start">
        <div className="lg:w-7/12 fade-up">
          <div className="flex flex-col gap-6 mb-12">
            <div className="flex items-center gap-4">
              <span className="text-xs font-sans tracking-[0.2em] uppercase text-ink-light">Vol. 04</span>
              <div className="h-px w-12 bg-ink-20"></div>
              <span className="text-xs font-sans tracking-[0.2em] uppercase text-accent">Prepared for Vantage</span>
            </div>
            <h1 className="text-6xl md:text-7xl lg:text-[5.5rem] font-serif leading-[1.05] text-ink">
              The Architecture of Personalization.
            </h1>
          </div>
          <p className="text-xl text-ink-light leading-relaxed max-w-2xl mb-12 font-sans font-light">
            As Vantage shifts toward higher-touch ABM strategies, the bottleneck is no longer data—it's content creation. We present a methodology to empower your revenue team to launch bespoke campaigns in minutes.
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <button className="btn-primary group flex items-center gap-3">
              Read the Brief
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        <div className="lg:w-5/12 w-full fade-up delay-200">
          <div className="bg-paper-dark p-10 md:p-14 relative border border-ink-10">
            <div className="absolute top-4 left-4 w-2 h-2 border-t border-l border-ink"></div>
            <div className="absolute top-4 right-4 w-2 h-2 border-t border-r border-ink"></div>
            <div className="absolute bottom-4 left-4 w-2 h-2 border-b border-l border-ink"></div>
            <div className="absolute bottom-4 right-4 w-2 h-2 border-b border-r border-ink"></div>
            
            <div className="text-center mb-10">
              <span className="text-[0.65rem] uppercase tracking-[0.3em] text-ink-light block mb-2">Dossier File</span>
              <h3 className="font-serif text-3xl text-ink italic">Account Brief</h3>
              <div className="w-12 h-px bg-accent mx-auto mt-6"></div>
            </div>
            
            <div className="space-y-6 text-sm font-sans">
              <div className="flex items-end justify-between hairline-b pb-3 border-ink-20">
                <span className="text-ink-light uppercase tracking-widest text-xs">Target</span>
                <span className="text-ink font-medium">Vantage</span>
              </div>
              <div className="flex items-end justify-between hairline-b pb-3 border-ink-20">
                <span className="text-ink-light uppercase tracking-widest text-xs">Profile</span>
                <span className="text-ink text-right">B2B SaaS Enterprise<br/><span className="text-ink-light text-xs font-light">(~2,000 employees)</span></span>
              </div>
              <div className="flex items-end justify-between hairline-b pb-3 border-ink-20">
                <span className="text-ink-light uppercase tracking-widest text-xs">Audience</span>
                <span className="text-ink">Marketing Leadership</span>
              </div>
              <div className="flex items-end justify-between hairline-b pb-3 border-ink-20">
                <span className="text-ink-light uppercase tracking-widest text-xs">Status</span>
                <span className="text-ink flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                  Engaged
                </span>
              </div>
              <div className="flex items-end justify-between hairline-b pb-3 border-ink-20">
                <span className="text-ink-light uppercase tracking-widest text-xs">Initiative</span>
                <span className="text-ink">ABM Account Pages</span>
              </div>
              <div className="flex items-center justify-between pt-4">
                <span className="text-ink-light uppercase tracking-widest text-xs">Assigned Team</span>
                <div className="flex gap-2">
                  {['JM', 'PS', 'ML'].map(initials => (
                    <div key={initials} className="text-ink font-serif italic text-sm">{initials}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full bleed image */}
      <section className="w-full h-[60vh] md:h-[80vh]">
        <img src="/__mockup/images/abm-editorial2-hero.png" alt="Architecture" className="w-full h-full object-cover grayscale opacity-90" />
      </section>

      {/* 3. Why this matters now */}
      <section className="py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-16">
          <div className="lg:col-span-4">
            <span className="text-xs font-sans tracking-[0.2em] uppercase text-accent mb-4 block">Part I</span>
            <h2 className="text-4xl md:text-5xl font-serif text-ink leading-tight">
              The Friction in Modern GTM
            </h2>
          </div>
          <div className="lg:col-span-8 lg:col-start-6">
            <p className="text-xl text-ink-light font-light leading-relaxed mb-16">
              We understand the specific challenges Vantage is facing. Scaling personalization historically required compromising on quality or overwhelming engineering teams.
            </p>
            
            <div className="grid md:grid-cols-2 gap-16">
              {[
                {
                  num: "01.",
                  title: "Rising Campaign Volume",
                  desc: "As go-to-market strategies become granular, the sheer number of pages required outpaces traditional CMS capabilities."
                },
                {
                  num: "02.",
                  title: "Brand Consistency",
                  desc: "When content creation is decentralized to field marketing, keeping the Vantage brand premium becomes difficult."
                },
                {
                  num: "03.",
                  title: "The Web Queue",
                  desc: "High-value campaigns sit idle waiting for engineering resources, extending time-to-market and reducing agility."
                }
              ].map((item, i) => (
                <div key={i} className="relative group">
                  <div className="text-accent font-serif italic text-2xl mb-4">{item.num}</div>
                  <h4 className="font-serif text-2xl mb-4 text-ink">{item.title}</h4>
                  <p className="text-ink-light leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Methodology */}
      <section id="methodology" className="py-32 bg-ink text-paper">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-24 max-w-3xl mx-auto">
            <span className="text-xs font-sans tracking-[0.2em] uppercase text-accent mb-6 block">Part II</span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-tight">
              A governed approach to personalized engagement
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-16 md:gap-8">
            {[
              {
                step: "Phase I",
                title: "Governed Templates",
                desc: "Design provides approved, on-brand foundational templates that revenue teams can safely access."
              },
              {
                step: "Phase II",
                title: "Targeted Personalization",
                desc: "Marketers customize content, messaging, and modules for the specific account and stage."
              },
              {
                step: "Phase III",
                title: "Connect the Follow-Through",
                desc: "Deploy instantly and track deep engagement metrics directly back to your CRM."
              }
            ].map((phase, i) => (
              <div key={i} className="text-center hairline-t border-paper/20 pt-8 relative group">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-paper rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="text-xs font-sans uppercase tracking-[0.2em] text-paper/50 mb-6">{phase.step}</div>
                <h4 className="font-serif text-3xl mb-4 text-paper">{phase.title}</h4>
                <p className="text-paper/70 font-light leading-relaxed max-w-sm mx-auto">{phase.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Use Cases & Value */}
      <section id="use-cases" className="py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <div>
            <span className="text-xs font-sans tracking-[0.2em] uppercase text-accent mb-4 block">Part III</span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-ink leading-tight mb-8">
              Campaign-ready in minutes.
            </h2>
            <p className="text-xl text-ink-light font-light leading-relaxed mb-12">
              By uncoupling content assembly from development, your team can leverage content reuse, ship faster, and maintain strict brand compliance without relying on web or design queues.
            </p>
            <img src="/__mockup/images/abm-editorial2-detail.png" alt="Detail" className="w-2/3 object-cover grayscale mix-blend-multiply opacity-90" />
          </div>

          <div className="space-y-0">
            {[
              {
                title: "ABM Account Pages",
                desc: "Dedicated 1:1 hubs for top-tier accounts like Vantage, bringing together personalized videos and relevant case studies.",
                team: "Field Marketing"
              },
              {
                title: "Webinar & Event Hubs",
                desc: "Pre and post-event experiences that house registration, recordings, and follow-up collateral in one journey.",
                team: "Demand Gen"
              },
              {
                title: "Campaign Landing Pages",
                desc: "High-converting destination pages for specific ad groups or outbound sequences, spun up autonomously.",
                team: "Performance"
              },
              {
                title: "Content & Podcast Hubs",
                desc: "Curated collections of thought leadership tailored to a specific vertical or buyer persona.",
                team: "Content"
              }
            ].map((useCase, i) => (
              <div key={i} className="py-8 hairline-b group">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-serif text-2xl text-ink group-hover:text-accent transition-colors">{useCase.title}</h4>
                  <span className="text-[0.65rem] font-sans uppercase tracking-widest text-ink-light border border-ink-20 px-2 py-1">{useCase.team}</span>
                </div>
                <p className="text-ink-light font-light leading-relaxed mb-4 max-w-md">
                  {useCase.desc}
                </p>
                <button className="text-xs font-sans uppercase tracking-[0.2em] text-ink hover:text-accent flex items-center gap-2 transition-colors">
                  View Example <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Proof */}
      <section id="evidence" className="py-32 bg-paper-dark hairline-t hairline-b">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid lg:grid-cols-12 gap-16 mb-24">
            <div className="lg:col-span-5">
              <span className="text-xs font-sans tracking-[0.2em] uppercase text-accent mb-4 block">Part IV</span>
              <h2 className="text-4xl md:text-5xl font-serif text-ink leading-tight">
                The Impact of Autonomous Marketing
              </h2>
            </div>
            <div className="lg:col-span-7 lg:col-start-6 flex gap-12 text-center">
              <div>
                <div className="text-6xl font-serif text-ink mb-2">75<span className="text-accent text-4xl">%</span></div>
                <div className="text-xs font-sans uppercase tracking-[0.1em] text-ink-light">Faster Launches</div>
              </div>
              <div className="w-px bg-ink-20"></div>
              <div>
                <div className="text-6xl font-serif text-ink mb-2">3<span className="text-accent text-4xl">x</span></div>
                <div className="text-xs font-sans uppercase tracking-[0.1em] text-ink-light">More Variations</div>
              </div>
              <div className="w-px bg-ink-20"></div>
              <div>
                <div className="text-6xl font-serif text-ink mb-2">42<span className="text-accent text-4xl">%</span></div>
                <div className="text-xs font-sans uppercase tracking-[0.1em] text-ink-light">Higher Engagement</div>
              </div>
            </div>
          </div>

          <div className="bg-paper p-12 md:p-20 border border-ink-10 relative">
            <Quote className="absolute top-12 left-12 w-16 h-16 text-ink-[0.03] text-ink opacity-5" />
            <div className="max-w-4xl mx-auto text-center relative z-10">
              <p className="text-3xl md:text-4xl font-serif text-ink leading-snug mb-10">
                "LP Studio fundamentally changed how we go to market. We no longer have to ask engineering for a landing page or wait weeks for design. We just build, personalize, and ship."
              </p>
              <div className="font-sans text-sm tracking-widest uppercase text-ink">Elena Higgins</div>
              <div className="font-serif italic text-ink-light mt-1">VP Marketing, Enterprise SaaS</div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Action Plan & Team */}
      <section id="action-plan" className="py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-24">
          
          <div>
            <span className="text-xs font-sans tracking-[0.2em] uppercase text-accent mb-4 block">Part V</span>
            <h2 className="text-4xl font-serif text-ink mb-12">Mutual Evaluation Plan</h2>
            
            <div className="space-y-0">
              {[
                { title: "Confirm ABM goals & metrics", owner: "Vantage + LP Studio", status: "completed" },
                { title: "Review bespoke strategy brief", owner: "Vantage", status: "current" },
                { title: "Select pilot campaign use case", owner: "Vantage", status: "upcoming" },
                { title: "Workflow & technical review", owner: "LP Studio SC", status: "upcoming" }
              ].map((step, i) => (
                <div key={i} className="flex gap-8 relative pb-12 last:pb-0">
                  {i !== 3 && <div className="absolute top-8 left-3 w-px h-[calc(100%-2rem)] bg-ink-20"></div>}
                  
                  <div className="shrink-0 mt-1 z-10 bg-paper py-1">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-6 h-6 text-ink" strokeWidth={1} />
                    ) : step.status === 'current' ? (
                      <div className="w-6 h-6 rounded-full border border-accent flex items-center justify-center bg-paper">
                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                      </div>
                    ) : (
                      <Circle className="w-6 h-6 text-ink-20" strokeWidth={1} />
                    )}
                  </div>
                  
                  <div className={`pt-1 ${step.status === 'upcoming' ? 'opacity-40' : ''}`}>
                    <h4 className="font-serif text-2xl text-ink mb-2">{step.title}</h4>
                    <div className="flex items-center gap-3 text-[0.65rem] font-sans uppercase tracking-[0.2em] text-ink-light">
                      <Briefcase className="w-3 h-3" />
                      {step.owner}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="bg-ink p-12 text-paper h-full flex flex-col justify-center">
              <h2 className="text-4xl font-serif mb-4">The LP Studio Team</h2>
              <p className="text-paper/60 font-light mb-12">Dedicated to Vantage's success.</p>
              
              <div className="space-y-8 mb-16">
                {[
                  { initials: "JM", name: "Jordan Mills", role: "Account Executive" },
                  { initials: "ML", name: "Marcus Lee", role: "Solutions Consultant" },
                  { initials: "PS", name: "Priya Sharma", role: "Customer Success" }
                ].map((member, i) => (
                  <div key={i} className="flex items-center gap-6 hairline-b border-paper/10 pb-6 last:border-0 last:pb-0">
                    <div className="w-12 h-12 rounded-full border border-paper/30 flex items-center justify-center font-serif italic text-paper text-lg">
                      {member.initials}
                    </div>
                    <div>
                      <div className="font-serif text-2xl text-paper mb-1">{member.name}</div>
                      <div className="text-[0.65rem] font-sans uppercase tracking-[0.2em] text-paper/50">{member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-4">
                <button className="btn-primary bg-paper text-ink border-paper hover:text-paper hover:bg-transparent hover:border-paper w-full">
                  Schedule Review
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 8. Footer */}
      <footer className="py-12 bg-ink text-center hairline-t border-paper/10">
        <div className="font-serif italic text-2xl font-bold text-paper mb-4">LP Studio</div>
        <div className="text-[0.65rem] font-sans uppercase tracking-[0.2em] text-paper/40">
          Prepared exclusively for Vantage • Confidential
        </div>
      </footer>
    </div>
  );
}
