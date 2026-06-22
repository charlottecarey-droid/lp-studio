import React, { useEffect, useState } from 'react';
import { 
  ArrowRight, ChevronRight, CheckCircle2, FileText, 
  LayoutTemplate, Users, Zap, BarChart3, Mail, Calendar, 
  ArrowUpRight, PlayCircle, ShieldCheck, Gauge, Check,
  Target, Presentation, Video
} from 'lucide-react';

export function DealRoom() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 border-b border-white/5 ${scrolled ? 'bg-slate-950/80 backdrop-blur-md py-4' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-bold text-white tracking-tighter">LP</div>
            <span className="font-semibold text-lg tracking-tight">Studio</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#overview" className="hover:text-white transition-colors">Overview</a>
            <a href="#approach" className="hover:text-white transition-colors">Approach</a>
            <a href="#use-cases" className="hover:text-white transition-colors">Use Cases</a>
            <a href="#proof" className="hover:text-white transition-colors">Proof</a>
            <a href="#map" className="hover:text-white transition-colors">Plan</a>
          </div>
          <button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)]">
            Talk through goals
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[95vh] flex items-center pt-20 overflow-hidden">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/__mockup/images/abm-dealroom-hero-bg.png" 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/60 to-slate-950"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-6">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              Strategic Brief
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Accelerating <br />
              revenue for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_30px_rgba(6,182,212,0.5)]">
                Vantage
              </span>
            </h1>
            <p className="text-xl text-slate-300 mb-10 max-w-xl leading-relaxed">
              Empower your marketing team to launch governed, on-brand ABM campaigns in minutes, not weeks.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-8 py-4 rounded-full text-base font-semibold transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2">
                Talk through goals <ArrowRight className="w-5 h-5" />
              </button>
              <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-4 rounded-full text-base font-semibold transition-all flex items-center gap-2 backdrop-blur-sm">
                <PlayCircle className="w-5 h-5" /> View examples
              </button>
            </div>
          </div>

          {/* Account Brief Card */}
          <div className="lg:col-span-5 hidden lg:block">
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 border-b border-white/10 pb-4">Account Intelligence</h3>
              
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Account</span>
                  <span className="font-semibold text-white">Vantage</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Segment</span>
                  <span className="font-semibold text-white">Enterprise (~2,000 emp)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Audience</span>
                  <span className="font-semibold text-white">Marketing Leadership</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Stage</span>
                  <div className="flex items-center gap-1.5 text-cyan-400 font-medium text-sm bg-cyan-500/10 px-2.5 py-1 rounded-full">
                    <Target className="w-3.5 h-3.5" /> Engaged
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Primary Use Case</span>
                  <span className="font-semibold text-white">ABM Account Pages</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-300">JM</div>
                  <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-300">PS</div>
                  <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-300">ML</div>
                </div>
                <span className="text-xs text-slate-400 font-medium">Prepared by your team</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar pinned to bottom */}
        <div className="absolute bottom-0 w-full border-t border-white/5 bg-slate-950/80 backdrop-blur-md">
          <div className="container mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">75%</div>
                <div className="text-sm text-slate-400 font-medium">Faster Page Launches</div>
              </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-white/10"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <LayoutTemplate className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">3x</div>
                <div className="text-sm text-slate-400 font-medium">More Campaign Variations</div>
              </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-white/10"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">42%</div>
                <div className="text-sm text-slate-400 font-medium">Higher Account Engagement</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why This Matters */}
      <section id="overview" className="py-32 bg-slate-900/30">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">The challenge at scale</h2>
            <p className="text-slate-400 text-lg">Marketing teams are asked to do more, personalized for more accounts, faster than ever.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Target className="w-8 h-8 text-cyan-400" />,
                title: "Campaign volume is rising",
                desc: "ABM requires personalized touchpoints for hundreds of accounts, overwhelming traditional web pipelines."
              },
              {
                icon: <ShieldCheck className="w-8 h-8 text-cyan-400" />,
                title: "Brand consistency suffers",
                desc: "When teams move fast without governed tools, rogue landing pages and off-brand assets proliferate."
              },
              {
                icon: <Gauge className="w-8 h-8 text-cyan-400" />,
                title: "Web queues slow launches",
                desc: "Waiting weeks for a developer to spin up a campaign hub means missing the window of opportunity."
              }
            ].map((card, i) => (
              <div key={i} className="bg-slate-900 border border-white/5 p-8 rounded-2xl hover:bg-slate-800 transition-colors duration-300">
                <div className="w-14 h-14 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center mb-6">
                  {card.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{card.title}</h3>
                <p className="text-slate-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recommended Approach */}
      <section id="approach" className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">A faster path to market for Vantage</h2>
              <p className="text-lg text-slate-400 mb-10 leading-relaxed">
                We recommend a decentralized but governed approach, empowering marketing to launch while design maintains control of the brand.
              </p>
              
              <div className="space-y-8">
                {[
                  { step: "01", title: "Start with governed templates", desc: "Design sets the rules. Marketing uses pre-approved, on-brand blocks to build." },
                  { step: "02", title: "Personalize by account & stage", desc: "Swap content, logos, and messaging dynamically for specific accounts like Vantage." },
                  { step: "03", title: "Connect the follow-through", desc: "Integrate directly with your CRM and marketing automation to track engagement." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6 group">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold font-mono group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
                        {item.step}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                      <p className="text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 blur-3xl rounded-[3rem] opacity-50"></div>
              <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative z-10">
                <div className="bg-slate-950 p-4 border-b border-white/5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                  </div>
                  <div className="mx-auto bg-slate-900 rounded-md text-xs text-slate-500 px-3 py-1 font-mono">lpstudio.app/builder</div>
                </div>
                <div className="p-8">
                  <div className="w-full h-8 bg-slate-800 rounded mb-4 w-3/4"></div>
                  <div className="w-full h-4 bg-slate-800 rounded mb-2 w-full"></div>
                  <div className="w-full h-4 bg-slate-800 rounded mb-8 w-5/6"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-32 bg-slate-800 rounded-lg"></div>
                    <div className="h-32 bg-cyan-500/20 border border-cyan-500/30 rounded-lg relative overflow-hidden">
                       <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMzMzMiLz48L3N2Zz4=')] opacity-50"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-32 bg-slate-950 border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Relevant for your team</h2>
              <p className="text-lg text-slate-400">Based on our conversations, here are the primary ways Vantage can leverage LP Studio immediately.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Presentation className="w-6 h-6" />,
                title: "ABM Account Pages",
                desc: "1:1 and 1:few personalized microsites for target enterprise accounts.",
                team: "Field Marketing",
              },
              {
                icon: <Video className="w-6 h-6" />,
                title: "Webinar Hubs",
                desc: "On-demand and live event hubs with gated content and speaker profiles.",
                team: "Demand Gen",
              },
              {
                icon: <FileText className="w-6 h-6" />,
                title: "Content & Podcast Hubs",
                desc: "Netflix-style media hubs to organize your best content and drive engagement.",
                team: "Content Marketing",
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "Campaign Landing Pages",
                desc: "High-converting, performance-tested pages for paid social and search.",
                team: "Performance",
              },
              {
                icon: <Calendar className="w-6 h-6" />,
                title: "Event Meeting Pages",
                desc: "Pre-book meetings for field events with rep-specific booking calendars.",
                team: "Field Marketing",
              }
            ].map((uc, i) => (
              <div key={i} className="group p-8 rounded-2xl bg-slate-900 border border-white/5 hover:border-cyan-500/30 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-cyan-500/10 transition-colors"></div>
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-cyan-400 mb-6">
                  {uc.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{uc.title}</h3>
                <p className="text-slate-400 mb-6 text-sm leading-relaxed">{uc.desc}</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{uc.team}</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof Section */}
      <section id="proof" className="py-32 bg-slate-900/30 border-y border-white/5">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Campaign-ready in minutes</h2>
              <ul className="space-y-6">
                {[
                  "Enforce brand consistency without bottlenecking marketing.",
                  "Create governed templates that anyone can deploy safely.",
                  "Spin up complex microsites, not just single pages.",
                  "Reuse content blocks across hundreds of campaigns instantly.",
                  "Remove dependency on web dev and design queues."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-slate-900 p-8 md:p-12 rounded-3xl border border-white/10 relative">
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-8 left-8 text-cyan-500/20">
                  <path d="M10 11L8 17H5L7 11V7H10V11ZM19 11L17 17H14L16 11V7H19V11Z" fill="currentColor"/>
                </svg>
              <blockquote className="text-2xl font-medium leading-relaxed mb-8 relative z-10 pt-6">
                "LP Studio completely changed our time-to-market. What used to take our web team 3 weeks now takes a field marketer 15 minutes. It's the most impactful tool in our stack."
              </blockquote>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10"></div>
                <div>
                  <div className="font-bold">Sarah Jenkins</div>
                  <div className="text-slate-400 text-sm">VP Demand Gen, Enterprise SaaS</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mutual Action Plan */}
      <section id="map" className="py-32">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Suggested Next Steps</h2>
            <p className="text-lg text-slate-400">A clear path to validating LP Studio for Vantage's specific use cases.</p>
          </div>

          <div className="space-y-6">
            {[
              { title: "Confirm goals & metrics", owner: "Vantage & LP Studio", status: "Done", desc: "Align on target launch speed and required integrations." },
              { title: "Select a pilot use case", owner: "Vantage", status: "In Progress", desc: "Choose one campaign type (e.g., ABM Pages) to prove value." },
              { title: "Review live examples", owner: "LP Studio", status: "Up Next", desc: "We'll show you exactly how a similar company builds these today." },
              { title: "Talk through workflow", owner: "Joint Team", status: "Pending", desc: "Deep dive into the builder and governance controls." }
            ].map((step, i) => (
              <div key={i} className="flex gap-6 items-start bg-slate-900/50 border border-white/5 p-6 rounded-2xl">
                <div className="mt-1">
                  {step.status === "Done" ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : step.status === "In Progress" ? (
                    <div className="w-6 h-6 rounded-full border-2 border-cyan-400 flex items-center justify-center">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-600"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                    <h4 className="text-lg font-bold">{step.title}</h4>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-800 px-2.5 py-1 rounded-md mt-2 sm:mt-0 inline-block w-fit">
                      {step.owner}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Account Team */}
      <section className="py-24 bg-slate-900 border-t border-white/5">
        <div className="container mx-auto px-6">
          <h2 className="text-2xl font-bold mb-10 text-center">Your Dedicated Team</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { initials: "JM", name: "Jordan Mills", role: "Account Executive", help: "Commercial alignment & strategy" },
              { initials: "PS", name: "Priya Shah", role: "Business Development", help: "Resources & coordination" },
              { initials: "ML", name: "Marcus Lee", role: "Solutions Consultant", help: "Technical deep-dives & architecture" }
            ].map((member, i) => (
              <div key={i} className="bg-slate-950 border border-white/5 p-6 rounded-2xl text-center hover:border-white/10 transition-colors">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 mx-auto flex items-center justify-center text-xl font-bold text-slate-300 mb-4 shadow-inner">
                  {member.initials}
                </div>
                <h4 className="text-lg font-bold">{member.name}</h4>
                <div className="text-cyan-400 text-sm font-medium mb-3">{member.role}</div>
                <p className="text-slate-400 text-sm mb-6 pb-6 border-b border-white/5">{member.help}</p>
                <div className="flex justify-center gap-3">
                  <button className="w-10 h-10 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-300">
                    <Mail className="w-4 h-4" />
                  </button>
                  <button className="w-10 h-10 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-300">
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-cyan-950/20"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[100px]"></div>
        
        <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">Ready to talk through your campaign goals?</h2>
          <p className="text-xl text-slate-300 mb-10">
            Let's discuss how LP Studio can specifically accelerate Vantage's marketing pipeline this quarter.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-8 py-4 rounded-full text-base font-semibold transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              Schedule a discussion
            </button>
            <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-4 rounded-full text-base font-semibold transition-all backdrop-blur-sm">
              Email Jordan
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 text-center text-sm text-slate-600">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <div>Prepared exclusively for Vantage</div>
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            Powered by <span className="font-semibold text-slate-400">LP Studio</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
