import React, { useEffect, useState } from 'react';
import './_dossier.css';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

export function Dossier() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="dossier-magazine min-h-screen selection:bg-accent/20 selection:text-ink">
      
      {/* Table of Contents / Index - Fixed Sidebar */}
      <aside className="hidden xl:flex flex-col fixed top-0 left-0 bottom-0 w-64 border-r border-ink-10 p-8 justify-between z-40 bg-paper">
        <div>
          <div className="font-serif italic text-2xl font-bold mb-16">LP Studio</div>
          <nav className="space-y-4">
            <div className="text-ink-muted label-text mb-6">Index</div>
            {['01. Brief', '02. Challenge', '03. Methodology', '04. Applications', '05. Evidence', '06. Action Plan'].map((item, idx) => (
              <a key={idx} href={`#section-${idx + 1}`} className="block label-text hover:text-accent transition-colors">
                {item}
              </a>
            ))}
          </nav>
        </div>
        <div className="text-ink-muted label-text">
          Vol. IV — Vantage<br />
          Prepared for Marketing
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="xl:ml-64 relative">
        
        {/* Mobile/Tablet Header */}
        <header className={`xl:hidden fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${scrolled ? 'bg-paper/95 backdrop-blur-sm border-b border-ink-10 py-4' : 'py-6'}`}>
          <div className="px-6 flex justify-between items-center">
            <div className="font-serif italic text-2xl font-bold">LP Studio</div>
            <div className="label-text">Vol. IV</div>
          </div>
        </header>

        {/* Section 01: Hero & Brief */}
        <section id="section-1" className="min-h-screen flex flex-col pt-24 xl:pt-16">
          <div className="px-6 md:px-12 lg:px-20 pt-10 pb-20 flex-grow flex flex-col justify-center">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
              
              <div className="lg:col-span-8 reveal-slow">
                <div className="label-text text-accent mb-8 flex items-center gap-4">
                  <span className="w-12 h-px bg-accent"></span>
                  Strategic Brief
                </div>
                <h1 className="display-1 text-ink mb-12">
                  Scaling personalized engagement at <span className="italic">Vantage</span>.
                </h1>
                <p className="body-text text-ink-muted max-w-2xl">
                  As your marketing team shifts toward higher-touch ABM strategies, the bottleneck is no longer data—it's content creation. Here is our recommended approach for empowering your revenue team to launch bespoke campaigns in minutes.
                </p>
              </div>

              {/* Marginalia / Account Brief */}
              <div className="lg:col-span-4 lg:pt-32 reveal-slow delay-200">
                <div className="border-l border-ink-10 pl-6 space-y-6">
                  <h3 className="font-serif text-2xl italic">Dossier Details</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="label-text text-ink-muted mb-1">Target Account</div>
                      <div className="font-serif text-lg">Vantage</div>
                    </div>
                    <div className="hairline-t pt-4">
                      <div className="label-text text-ink-muted mb-1">Industry & Scale</div>
                      <div className="font-serif text-lg">B2B SaaS / Enterprise</div>
                      <div className="body-text text-sm">~2,000 employees</div>
                    </div>
                    <div className="hairline-t pt-4">
                      <div className="label-text text-ink-muted mb-1">Primary Audience</div>
                      <div className="font-serif text-lg">Marketing Leadership</div>
                    </div>
                    <div className="hairline-t pt-4">
                      <div className="label-text text-ink-muted mb-1">Engagement Stage</div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent"></span>
                        <span className="font-serif text-lg">Active</span>
                      </div>
                    </div>
                    <div className="hairline-t pt-4">
                      <div className="label-text text-ink-muted mb-1">Prepared By</div>
                      <div className="font-serif text-lg">JM, PS, ML</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Full bleed hero image */}
          <div className="h-[60vh] w-full reveal-slow delay-300">
            <img src="/__mockup/images/abm-dossier-hero.png" alt="Architecture" className="art-directed-img" />
          </div>
        </section>

        {/* Section 02: Challenge */}
        <section id="section-2" className="py-32 px-6 md:px-12 lg:px-20 bg-paper-alt">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-4">
              <div className="sticky top-32">
                <div className="label-text text-ink-muted mb-4">02. The Challenge</div>
                <h2 className="display-2 mb-8">The friction in modern GTM</h2>
                <a href="#section-3" className="btn-editorial">Explore Methodology <ArrowRight className="w-4 h-4" /></a>
              </div>
            </div>
            <div className="lg:col-span-8">
              <p className="pull-quote text-ink mb-16 max-w-3xl">
                We understand the specific challenges Vantage is facing. Scaling personalization historically required compromising on quality or overwhelming your engineering teams.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <div className="text-accent font-serif text-4xl italic">I.</div>
                  <h4 className="font-serif text-2xl">Rising Campaign Volume</h4>
                  <p className="body-text text-ink-muted">
                    As go-to-market strategies become more granular, the sheer number of pages and hubs required outpaces traditional CMS capabilities.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="text-accent font-serif text-4xl italic">II.</div>
                  <h4 className="font-serif text-2xl">Brand Consistency</h4>
                  <p className="body-text text-ink-muted">
                    When content creation is decentralized to sales and field marketing, keeping the Vantage brand premium and unified becomes incredibly difficult.
                  </p>
                </div>
                <div className="space-y-4 sm:col-span-2">
                  <div className="text-accent font-serif text-4xl italic">III.</div>
                  <h4 className="font-serif text-2xl">The Web Queue Bottleneck</h4>
                  <p className="body-text text-ink-muted max-w-2xl">
                    High-value campaigns sit idle waiting for engineering or design resources, extending time-to-market and reducing overall agility.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mid-article Art */}
        <section className="py-20 px-6 md:px-12 lg:px-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 px-8 md:px-16 text-center">
              <p className="pull-quote">"The best marketing feels like a service, not a broadcast."</p>
            </div>
            <div className="order-1 md:order-2 aspect-[3/4] overflow-hidden bg-ink-10">
              <img src="/__mockup/images/abm-dossier-art-1.png" alt="Professionals" className="art-directed-img duotone" />
            </div>
          </div>
        </section>

        {/* Section 03: Methodology */}
        <section id="section-3" className="py-32 px-6 md:px-12 lg:px-20 hairline-t">
          <div className="text-center max-w-3xl mx-auto mb-24">
            <div className="label-text text-ink-muted mb-6">03. Methodology</div>
            <h2 className="display-2">A governed approach to personalized engagement</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12 lg:gap-20">
            {[
              { num: "01", title: "Governed Templates", desc: "Design provides approved, on-brand foundational templates that revenue teams can safely access." },
              { num: "02", title: "Targeted Personalization", desc: "Marketers and sellers customize content, messaging, and modules for the specific account, audience, and stage." },
              { num: "03", title: "Connect the Follow-Through", desc: "Deploy the page instantly and track deep engagement metrics directly back to your CRM." }
            ].map((step, idx) => (
              <div key={idx} className="relative">
                <div className="text-8xl font-serif text-ink-10 absolute -top-10 -left-6 -z-10 select-none">{step.num}</div>
                <h4 className="font-serif text-2xl mb-4 pt-4 hairline-t">{step.title}</h4>
                <p className="body-text text-ink-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 04: Applications (Use Cases) */}
        <section id="section-4" className="py-32 bg-ink text-paper">
          <div className="px-6 md:px-12 lg:px-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              <div className="lg:col-span-5">
                <div className="sticky top-32">
                  <div className="label-text text-accent mb-4">04. Applications</div>
                  <h2 className="display-2 mb-8">Campaign-ready in minutes.</h2>
                  <p className="body-text text-paper-alt/70 mb-10">
                    By uncoupling content assembly from development, your team can leverage content reuse, ship faster, and maintain strict brand compliance without relying on web or design queues.
                  </p>
                  <button className="btn-editorial text-paper border-paper hover:text-accent hover:border-accent">
                    View Interactive Examples <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 lg:col-start-7 space-y-16">
                {[
                  { title: "ABM Account Pages", team: "Field Marketing & Sales", desc: "Dedicated 1:1 hubs for top-tier accounts like Vantage, bringing together personalized videos, relevant case studies, and exact pricing structures." },
                  { title: "Webinar & Event Hubs", team: "Demand Generation", desc: "Pre and post-event experiences that house registration, speaker bios, on-demand recordings, and follow-up collateral in one seamless journey." },
                  { title: "Campaign Landing Pages", team: "Performance Marketing", desc: "High-converting destination pages for specific ad groups or outbound sequences, spun up without touching the core CMS." },
                  { title: "Content & Podcast Hubs", team: "Content Marketing", desc: "Curated collections of thought leadership tailored to a specific vertical or buyer persona, designed for binge-consumption." }
                ].map((uc, i) => (
                  <div key={i} className="group">
                    <div className="label-text text-accent mb-2">{uc.team}</div>
                    <h4 className="font-serif text-3xl mb-4">{uc.title}</h4>
                    <p className="body-text text-paper-alt/70 mb-6">{uc.desc}</p>
                    <div className="h-px w-full bg-paper-alt/20 group-hover:bg-accent transition-colors duration-500"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 05: Evidence */}
        <section id="section-5" className="py-32 px-6 md:px-12 lg:px-20 bg-paper">
          <div className="label-text text-ink-muted mb-12 text-center">05. Evidence</div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink-10 border border-ink-10 mb-20">
            <div className="bg-paper p-12 text-center flex flex-col items-center justify-center">
              <div className="font-serif text-7xl mb-4">75<span className="text-accent text-5xl">%</span></div>
              <div className="label-text text-ink-muted">Faster page launches</div>
            </div>
            <div className="bg-paper p-12 text-center flex flex-col items-center justify-center">
              <div className="font-serif text-7xl mb-4">3<span className="text-accent text-5xl">x</span></div>
              <div className="label-text text-ink-muted">More campaign variations</div>
            </div>
            <div className="bg-paper p-12 text-center flex flex-col items-center justify-center">
              <div className="font-serif text-7xl mb-4">42<span className="text-accent text-5xl">%</span></div>
              <div className="label-text text-ink-muted">Higher engagement</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="pull-quote text-ink mb-8">
                "LP Studio fundamentally changed how we go to market. We no longer have to ask engineering for a landing page or wait weeks for design. We just build, personalize, and ship."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-ink text-paper rounded-full flex items-center justify-center font-serif italic text-xl">
                  EH
                </div>
                <div>
                  <div className="font-bold text-sm uppercase tracking-wider">Elena Higgins</div>
                  <div className="text-ink-muted text-sm">VP Marketing, Enterprise SaaS</div>
                </div>
              </div>
            </div>
            <div className="aspect-[4/3] bg-paper-alt flex flex-col items-center justify-center p-8 text-center relative overflow-hidden group cursor-pointer border border-ink-10">
               <img src="/__mockup/images/abm-dossier-art-2.png" alt="Still life" className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-multiply group-hover:scale-105 transition-transform duration-700" />
               <div className="relative z-10">
                 <div className="w-16 h-16 rounded-full border border-ink flex items-center justify-center mx-auto mb-6 group-hover:bg-ink group-hover:text-paper transition-colors">
                   <ArrowRight className="w-6 h-6" />
                 </div>
                 <h4 className="font-serif text-2xl mb-2">Read the Acme Corp Case Study</h4>
                 <p className="body-text text-ink-muted text-sm">See how a similar enterprise scaled their ABM motion.</p>
               </div>
            </div>
          </div>
        </section>

        {/* Resources / Recommended Reading */}
        <section className="py-24 px-6 md:px-12 lg:px-20 hairline-t bg-paper-alt">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="font-serif text-4xl mb-4">Curated Reading</h2>
              <p className="body-text text-ink-muted">Selected volumes relevant to Vantage.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {[
              { type: "Guide", title: "The Enterprise Guide to ABM Content", time: "10 min read" },
              { type: "Showcase", title: "Live ABM Hub Examples", time: "Interactive" },
              { type: "Report", title: "State of Personalization 2024", time: "15 min read" },
              { type: "Briefing", title: "Scaling Beyond the CMS", time: "45 min watch" }
            ].map((res, i) => (
              <a key={i} href="#" className="group block">
                <div className="aspect-[3/4] border border-ink-10 bg-paper p-6 flex flex-col justify-between mb-4 group-hover:border-ink transition-colors relative overflow-hidden">
                  <div className="label-text text-accent">{res.type}</div>
                  <h4 className="font-serif text-2xl leading-tight relative z-10">{res.title}</h4>
                  <div className="absolute -bottom-10 -right-10 text-9xl font-serif text-ink-10 group-hover:-translate-y-4 group-hover:-translate-x-4 transition-transform duration-500">
                    {i+1}
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs uppercase tracking-widest text-ink-muted font-medium">
                  <span>{res.time}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Section 06: Mutual Action Plan & Team */}
        <section id="section-6" className="py-32 px-6 md:px-12 lg:px-20 bg-ink text-paper">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
            
            {/* Mutual Action Plan */}
            <div className="lg:col-span-7">
              <div className="label-text text-accent mb-6">06. Action Plan</div>
              <h2 className="display-2 mb-16">Mutual Evaluation</h2>
              
              <div className="space-y-12">
                {[
                  { title: "Confirm ABM goals & metrics", owner: "Vantage + LP Studio", status: "completed", desc: "Initial discovery to align on what success looks like for the upcoming quarter." },
                  { title: "Review bespoke strategy brief", owner: "Vantage", status: "current", desc: "You are here. Evaluate the proposed methodology and use cases in this dossier." },
                  { title: "Select pilot campaign use case", owner: "Vantage", status: "upcoming", desc: "Identify one specific, upcoming campaign to prototype in LP Studio." },
                  { title: "Technical architecture review", owner: "LP Studio SC", status: "upcoming", desc: "Deep dive into CRM integration, SSO, and existing CMS co-existence." }
                ].map((step, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="shrink-0 mt-1">
                      <div className="font-serif italic text-2xl text-paper-alt/50">
                        {String(i + 1).padStart(2, '0')}.
                      </div>
                    </div>
                    <div className={`${step.status === 'upcoming' ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-serif text-2xl">{step.title}</h4>
                        {step.status === 'current' && <span className="label-text text-accent bg-accent/10 px-2 py-1">Current</span>}
                      </div>
                      <div className="label-text text-paper-alt/50 mb-3">{step.owner}</div>
                      <p className="body-text text-paper-alt/70">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Account Team */}
            <div className="lg:col-span-5">
              <div className="bg-paper text-ink p-10 md:p-14">
                <h3 className="font-serif text-3xl mb-10">Your dedicated team</h3>
                
                <div className="space-y-10 mb-16">
                  {[
                    { initials: "JM", name: "Jordan Mills", role: "Account Executive", focus: "Commercial alignment" },
                    { initials: "ML", name: "Marcus Lee", role: "Solutions Consultant", focus: "Technical architecture" },
                    { initials: "PS", name: "Priya Sharma", role: "Customer Success", focus: "Implementation strategy" }
                  ].map((member, i) => (
                    <div key={i} className="flex gap-5 items-center">
                      <div className="w-14 h-14 shrink-0 rounded-full border border-ink flex items-center justify-center font-serif italic text-xl">
                        {member.initials}
                      </div>
                      <div>
                        <div className="font-bold uppercase tracking-wider text-sm mb-1">{member.name}</div>
                        <div className="text-ink-muted text-sm">{member.role}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pt-8 hairline-t">
                  <button className="btn-primary w-full group">
                    Schedule Technical Review
                  </button>
                  <button className="w-full text-center label-text py-4 border border-ink-20 hover:bg-ink-10 transition-colors">
                    Email Account Team
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 md:px-12 lg:px-20 text-center hairline-t">
          <div className="font-serif italic text-xl mb-4">LP Studio</div>
          <div className="label-text text-ink-muted">© {new Date().getFullYear()} — Confidential Dossier</div>
        </footer>

      </main>
    </div>
  );
}
