import React, { useEffect, useState } from 'react';
import { 
  ArrowRight, 
  Building2, 
  Users, 
  Target, 
  PlayCircle, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Circle,
  LayoutTemplate,
  Fingerprint,
  Share2,
  Quote,
  Clock,
  Briefcase,
  Mail,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Laptop
} from 'lucide-react';
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
    <div className="editorial-brief min-h-screen selection:bg-coral/20 selection:text-navy">
      {/* 1. Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b border-transparent ${scrolled ? 'bg-ivory/90 backdrop-blur-md border-navy-10 py-4' : 'py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 bg-navy flex items-center justify-center rounded-sm transition-transform group-hover:scale-105">
              <span className="text-ivory font-serif italic font-bold text-xl leading-none">L</span>
            </div>
            <span className="font-serif text-xl tracking-tight text-navy">LP Studio</span>
          </div>
          
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-navy-muted">
            {['Overview', 'Plan', 'Use Cases', 'Proof', 'Resources'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} className="hover:text-navy transition-colors">
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-navy hidden md:block hover:text-coral transition-colors">
              Sign In
            </button>
            <button className="btn-primary">
              Talk through your goals
            </button>
          </div>
        </div>
      </header>

      {/* 2. Personalized Hero */}
      <section id="overview" className="pt-40 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
        <div className="lg:w-7/12 fade-up">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-[1px] w-12 bg-coral"></div>
            <span className="text-sm font-medium text-coral tracking-widest uppercase">Strategic Brief Prepared For</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-serif leading-[1.05] text-navy mb-8">
            Scaling personalized <br/>
            engagement at <span className="italic text-coral">Vantage</span>.
          </h1>
          <p className="text-lg md:text-xl text-navy-muted leading-relaxed max-w-2xl mb-10 font-light">
            As your marketing team shifts toward higher-touch ABM strategies, the bottleneck is no longer data—it's content creation. Here is our recommended approach for empowering your revenue team to launch bespoke campaigns in minutes.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn-primary flex items-center gap-2 group">
              Review our recommended plan
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="btn-secondary">
              See live examples
            </button>
          </div>
        </div>

        <div className="lg:w-5/12 w-full fade-up delay-200">
          <div className="bg-ivory-dark border border-navy-10 p-8 relative">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-navy"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-navy"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-navy"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-navy"></div>
            
            <h3 className="font-serif text-2xl mb-6 text-navy">Account Brief</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex items-start justify-between hairline-b pb-4">
                <span className="text-navy-muted font-medium">Target Account</span>
                <span className="text-navy font-semibold text-right">Vantage</span>
              </div>
              <div className="flex items-start justify-between hairline-b pb-4">
                <span className="text-navy-muted font-medium">Industry & Segment</span>
                <span className="text-navy text-right">B2B SaaS • Enterprise<br/>(~2,000 employees)</span>
              </div>
              <div className="flex items-start justify-between hairline-b pb-4">
                <span className="text-navy-muted font-medium">Audience</span>
                <span className="text-navy text-right">Marketing Leadership</span>
              </div>
              <div className="flex items-start justify-between hairline-b pb-4">
                <span className="text-navy-muted font-medium">Stage</span>
                <span className="text-navy text-right flex items-center gap-2 justify-end">
                  <div className="w-2 h-2 rounded-full bg-coral"></div>
                  Engaged
                </span>
              </div>
              <div className="flex items-start justify-between hairline-b pb-4">
                <span className="text-navy-muted font-medium">Primary Initiative</span>
                <span className="text-navy text-right">ABM Account Pages</span>
              </div>
              <div className="flex items-start justify-between pt-2">
                <span className="text-navy-muted font-medium">LP Studio Team</span>
                <div className="flex -space-x-2 justify-end">
                  <div className="w-8 h-8 rounded-full bg-navy text-ivory flex items-center justify-center text-xs font-serif italic border border-ivory">JM</div>
                  <div className="w-8 h-8 rounded-full bg-navy text-ivory flex items-center justify-center text-xs font-serif italic border border-ivory">PS</div>
                  <div className="w-8 h-8 rounded-full bg-navy text-ivory flex items-center justify-center text-xs font-serif italic border border-ivory">ML</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Why this matters now */}
      <section className="py-24 border-t border-navy-10 bg-ivory">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row gap-12 items-start justify-between mb-16">
            <h2 className="text-4xl font-serif text-navy lg:w-1/3 leading-tight">
              The friction in <br/> modern GTM
            </h2>
            <p className="text-lg text-navy-muted font-light lg:w-1/2 leading-relaxed">
              We understand the specific challenges Vantage is facing. Scaling personalization historically required compromising on quality or overwhelming your engineering teams.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-x-8 gap-y-12">
            {[
              {
                title: "Rising Campaign Volume",
                desc: "As go-to-market strategies become more granular, the sheer number of pages and hubs required outpaces traditional CMS capabilities.",
                icon: <TrendingUp className="w-5 h-5 text-coral" />
              },
              {
                title: "Brand Consistency at Scale",
                desc: "When content creation is decentralized to sales and field marketing, keeping the Vantage brand premium and unified becomes incredibly difficult.",
                icon: <LayoutTemplate className="w-5 h-5 text-coral" />
              },
              {
                title: "The Web Queue Bottleneck",
                desc: "High-value campaigns sit idle waiting for engineering or design resources, extending time-to-market and reducing overall agility.",
                icon: <Clock className="w-5 h-5 text-coral" />
              }
            ].map((card, i) => (
              <div key={i} className="group relative">
                <div className="mb-6">{card.icon}</div>
                <h4 className="font-serif text-2xl mb-3 text-navy">{card.title}</h4>
                <p className="text-navy-muted text-sm leading-relaxed">{card.desc}</p>
                <div className="absolute top-0 left-0 w-full h-[1px] bg-navy-10 group-hover:bg-coral transition-colors duration-500"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hero Art Break */}
      <div className="w-full h-64 md:h-96 relative overflow-hidden">
        <img src="/__mockup/images/abm-editorial-art-1.png" alt="Editorial art" className="w-full h-full object-cover grayscale opacity-80 mix-blend-multiply" />
        <div className="absolute inset-0 bg-ivory mix-blend-color opacity-50"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-ivory to-transparent"></div>
      </div>

      {/* 4. Recommended approach */}
      <section id="plan" className="py-24 bg-ivory">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-20 max-w-2xl mx-auto">
            <span className="text-sm font-medium text-coral tracking-widest uppercase block mb-4">The Methodology</span>
            <h2 className="text-4xl md:text-5xl font-serif text-navy leading-tight">
              A governed approach to personalized engagement
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-[1px] bg-navy-10"></div>
            
            {[
              {
                step: "01",
                title: "Governed Templates",
                desc: "Design provides approved, on-brand foundational templates that revenue teams can safely access."
              },
              {
                step: "02",
                title: "Targeted Personalization",
                desc: "Marketers and sellers customize content, messaging, and modules for the specific account, audience, and stage."
              },
              {
                step: "03",
                title: "Connect the Follow-Through",
                desc: "Deploy the page instantly and track deep engagement metrics directly back to your CRM."
              }
            ].map((phase, i) => (
              <div key={i} className="relative z-10 text-center px-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-ivory-dark border border-navy flex items-center justify-center text-2xl font-serif text-navy mb-8 shadow-[0_0_0_8px_hsl(var(--color-ivory))]">
                  {phase.step}
                </div>
                <h4 className="font-serif text-2xl mb-4 text-navy">{phase.title}</h4>
                <p className="text-navy-muted text-sm leading-relaxed">{phase.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Relevant use cases & 6. Audience Value (Combined side-by-side) */}
      <section id="use-cases" className="py-24 bg-navy text-ivory">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col lg:flex-row gap-16">
            
            <div className="lg:w-1/3">
              <div className="sticky top-32">
                <span className="text-sm font-medium text-coral tracking-widest uppercase block mb-4">Value Realized</span>
                <h2 className="text-4xl md:text-5xl font-serif leading-tight mb-8">
                  Campaign-ready in minutes.
                </h2>
                <p className="text-ivory/70 text-lg font-light leading-relaxed mb-8">
                  By uncoupling content assembly from development, your team can leverage content reuse, ship faster, and maintain strict brand compliance without relying on web or design queues.
                </p>
                <button className="text-coral hover:text-ivory transition-colors flex items-center gap-2 text-sm font-medium uppercase tracking-widest">
                  View Case Studies <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:w-2/3 space-y-4">
              {[
                {
                  title: "ABM Account Pages",
                  desc: "Dedicated 1:1 hubs for top-tier accounts like Vantage, bringing together personalized videos, relevant case studies, and exact pricing structures.",
                  team: "Field Marketing & Sales",
                  icon: <Target className="w-5 h-5" />
                },
                {
                  title: "Webinar & Event Hubs",
                  desc: "Pre and post-event experiences that house registration, speaker bios, on-demand recordings, and follow-up collateral in one seamless journey.",
                  team: "Demand Generation",
                  icon: <PlayCircle className="w-5 h-5" />
                },
                {
                  title: "Campaign Landing Pages",
                  desc: "High-converting destination pages for specific ad groups or outbound sequences, spun up without touching the core CMS.",
                  team: "Performance Marketing",
                  icon: <LayoutTemplate className="w-5 h-5" />
                },
                {
                  title: "Content & Podcast Hubs",
                  desc: "Curated collections of thought leadership tailored to a specific vertical or buyer persona, designed for binge-consumption.",
                  team: "Content Marketing",
                  icon: <FileText className="w-5 h-5" />
                }
              ].map((useCase, i) => (
                <div key={i} className="group border border-ivory/20 p-8 hover:bg-ivory/5 transition-colors duration-300">
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <div className="p-3 bg-ivory/10 text-ivory shrink-0">
                      {useCase.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <h4 className="font-serif text-2xl text-ivory">{useCase.title}</h4>
                        <span className="text-xs font-medium text-coral border border-coral/30 px-2 py-1 rounded-full whitespace-nowrap">
                          {useCase.team}
                        </span>
                      </div>
                      <p className="text-ivory/70 text-sm leading-relaxed mb-6">
                        {useCase.desc}
                      </p>
                      <button className="text-xs font-medium uppercase tracking-widest text-ivory/50 group-hover:text-ivory flex items-center gap-2 transition-colors">
                        See Example <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* 7. Proof */}
      <section id="proof" className="py-24 bg-ivory-dark relative overflow-hidden">
        <img src="/__mockup/images/abm-editorial-art-2.png" alt="Texture" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-30" />
        
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="flex flex-col md:flex-row gap-12 items-end justify-between mb-16 hairline-b border-navy-20 pb-8">
            <h2 className="text-4xl font-serif text-navy lg:w-1/2 leading-tight">
              The impact of <br/> autonomous marketing
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="border border-navy p-8">
              <div className="text-5xl font-serif text-navy mb-2">75<span className="text-coral">%</span></div>
              <p className="text-navy-muted font-medium text-sm">Faster page launches compared to traditional CMS workflows.</p>
            </div>
            <div className="border border-navy p-8">
              <div className="text-5xl font-serif text-navy mb-2">3<span className="text-coral">x</span></div>
              <p className="text-navy-muted font-medium text-sm">More campaign variations shipped per quarter by the same team size.</p>
            </div>
            <div className="border border-navy p-8 bg-navy text-ivory">
              <div className="text-5xl font-serif mb-2">42<span className="text-coral">%</span></div>
              <p className="text-ivory/80 font-medium text-sm">Increase in account engagement duration for personalized hubs.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="bg-ivory p-12 border border-navy-10">
              <Quote className="w-10 h-10 text-coral mb-6 opacity-50" />
              <p className="text-2xl font-serif text-navy leading-snug mb-8">
                "LP Studio fundamentally changed how we go to market. We no longer have to ask engineering for a landing page or wait weeks for design. We just build, personalize, and ship."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-navy-10 rounded-full flex items-center justify-center">
                  <span className="text-navy font-serif italic text-lg">EH</span>
                </div>
                <div>
                  <div className="font-semibold text-navy text-sm">Elena Higgins</div>
                  <div className="text-navy-muted text-xs">VP Marketing, Enterprise SaaS</div>
                </div>
              </div>
            </div>

            <div className="aspect-[4/3] bg-navy/5 border border-navy-10 flex flex-col items-center justify-center text-center p-8 group cursor-pointer hover:bg-navy/10 transition-colors">
              <PlayCircle className="w-16 h-16 text-navy/30 mb-4 group-hover:text-coral transition-colors" />
              <h4 className="font-serif text-xl text-navy mb-2">Watch the Acme Corp Case Study</h4>
              <p className="text-sm text-navy-muted">See how a similar enterprise scaled their ABM motion.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Recommended Resources */}
      <section id="resources" className="py-24 bg-ivory">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="mb-16">
            <h2 className="text-3xl font-serif text-navy mb-4">Curated for Vantage</h2>
            <p className="text-navy-muted">Selected reading and examples relevant to your ABM initiatives.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { type: "Guide", title: "The Enterprise Guide to ABM Content", time: "10 min read" },
              { type: "Example", title: "Live ABM Hub Showcase", time: "Interactive" },
              { type: "Report", title: "State of Personalization 2024", time: "15 min read" },
              { type: "Webinar", title: "Scaling Beyond the CMS", time: "45 min watch" }
            ].map((resource, i) => (
              <a key={i} href="#" className="block group">
                <div className="aspect-[3/4] bg-ivory-dark border border-navy-10 p-6 flex flex-col justify-between mb-4 group-hover:border-navy transition-colors">
                  <div className="text-xs font-bold uppercase tracking-widest text-coral">{resource.type}</div>
                  <h4 className="font-serif text-xl text-navy leading-snug">{resource.title}</h4>
                </div>
                <div className="flex items-center justify-between text-xs text-navy-muted font-medium uppercase tracking-widest">
                  <span>{resource.time}</span>
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-navy" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Mutual Action Plan & 10. Account Team */}
      <section className="py-24 border-t border-navy-10 bg-ivory">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid lg:grid-cols-12 gap-16">
            
            {/* Mutual Action Plan */}
            <div className="lg:col-span-7">
              <h2 className="text-3xl font-serif text-navy mb-8">Mutual Evaluation Plan</h2>
              <div className="space-y-0">
                {[
                  { title: "Confirm ABM goals & metrics", owner: "Vantage + LP Studio", status: "completed", desc: "Initial discovery to align on what success looks like for the upcoming quarter." },
                  { title: "Review bespoke strategy brief", owner: "Vantage", status: "current", desc: "You are here. Evaluate the proposed methodology and use cases." },
                  { title: "Select pilot campaign use case", owner: "Vantage", status: "upcoming", desc: "Identify one specific, upcoming campaign to prototype in LP Studio." },
                  { title: "Workflow & integration technical review", owner: "LP Studio SC", status: "upcoming", desc: "Deep dive into CRM integration, SSO, and existing CMS co-existence." }
                ].map((step, i) => (
                  <div key={i} className="flex gap-6 relative pb-10 last:pb-0">
                    {/* Timeline line */}
                    {i !== 3 && <div className="absolute top-8 left-3 w-px h-[calc(100%-2rem)] bg-navy-10"></div>}
                    
                    <div className="shrink-0 mt-1 z-10 bg-ivory py-1">
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="w-6 h-6 text-navy" />
                      ) : step.status === 'current' ? (
                        <div className="w-6 h-6 rounded-full border-2 border-coral flex items-center justify-center bg-ivory">
                          <div className="w-2 h-2 rounded-full bg-coral"></div>
                        </div>
                      ) : (
                        <Circle className="w-6 h-6 text-navy-20" />
                      )}
                    </div>
                    
                    <div className={`pt-1 ${step.status === 'upcoming' ? 'opacity-50' : ''}`}>
                      <h4 className="font-serif text-xl text-navy mb-1">{step.title}</h4>
                      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-navy-muted mb-3">
                        <Briefcase className="w-3 h-3" />
                        {step.owner}
                      </div>
                      <p className="text-sm text-navy-muted leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Account Team */}
            <div className="lg:col-span-5">
              <div className="bg-navy p-8 lg:p-10 text-ivory">
                <h2 className="text-3xl font-serif mb-2">Your dedicated team</h2>
                <p className="text-ivory/70 text-sm mb-10 font-light">We're here to help Vantage evaluate and succeed.</p>

                <div className="space-y-8">
                  {[
                    { initials: "JM", name: "Jordan Mills", role: "Account Executive", help: "Commercial alignment & partnership strategy" },
                    { initials: "ML", name: "Marcus Lee", role: "Solutions Consultant", help: "Technical architecture & implementation" },
                    { initials: "PS", name: "Priya Shah", role: "Business Development", help: "Resources & scheduling" }
                  ].map((member, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-ivory/10 border border-ivory/20 flex items-center justify-center font-serif text-lg italic text-ivory shrink-0">
                        {member.initials}
                      </div>
                      <div>
                        <h4 className="font-serif text-lg">{member.name}</h4>
                        <div className="text-coral text-xs font-medium uppercase tracking-widest mb-2">{member.role}</div>
                        <p className="text-ivory/60 text-xs mb-3">{member.help}</p>
                        <div className="flex gap-4">
                          <button className="text-ivory/40 hover:text-ivory transition-colors">
                            <Mail className="w-4 h-4" />
                          </button>
                          <button className="text-ivory/40 hover:text-ivory transition-colors">
                            <Calendar className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="py-32 bg-ivory text-center border-t border-navy-10">
        <div className="max-w-3xl mx-auto px-6">
          <div className="w-16 h-1px bg-coral mx-auto mb-8"></div>
          <h2 className="text-4xl md:text-6xl font-serif text-navy mb-6 leading-tight">
            Ready to talk through <br/> your campaign goals?
          </h2>
          <p className="text-lg text-navy-muted font-light mb-10 max-w-xl mx-auto">
            Grab 30 minutes with Jordan and Marcus to discuss Vantage's specific architecture and see a live technical demonstration.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="btn-primary flex items-center gap-2 group">
              Schedule technical deep-dive
              <Calendar className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
            <button className="btn-secondary">
              Email Jordan
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-navy text-ivory/40 text-center text-xs font-medium uppercase tracking-widest border-t border-ivory/10">
        <p>Prepared securely via LP Studio for Vantage</p>
      </footer>
    </div>
  );
}
