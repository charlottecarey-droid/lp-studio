import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  LayoutTemplate,
  Library,
  LineChart,
  MessageSquare,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Calendar,
  Mail,
  ArrowUpRight,
  Building,
  Target,
  BarChart3,
  Layers
} from "lucide-react";

export function WarmSpotlight() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          isScrolled
            ? "bg-white/80 backdrop-blur-md shadow-sm py-3"
            : "bg-transparent py-6"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              L
            </div>
            <span className="font-semibold text-lg tracking-tight">
              LP Studio
            </span>
          </div>
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#overview" className="hover:text-indigo-600 transition-colors">Overview</a>
            <a href="#approach" className="hover:text-indigo-600 transition-colors">Plan</a>
            <a href="#use-cases" className="hover:text-indigo-600 transition-colors">Use Cases</a>
            <a href="#proof" className="hover:text-indigo-600 transition-colors">Proof</a>
            <a href="#team" className="hover:text-indigo-600 transition-colors">Team</a>
          </nav>
          <button className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95">
            Talk through your goals
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 overflow-hidden flex flex-col items-center justify-center text-center px-6">
        {/* Background art generated earlier */}
        <div className="absolute inset-0 -z-10 w-full h-full opacity-30 pointer-events-none">
          <img
            src="/__mockup/images/abm-warm-spotlight-bg.png"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#FDFDFD]" />
        </div>
        
        {/* Crest */}
        <div className="mb-8 relative group cursor-default">
          <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-indigo-100/50 flex items-center justify-center relative border border-slate-100/50 transform transition-transform duration-500 hover:scale-105">
            <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-indigo-600 to-violet-500">
              V
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 backdrop-blur-sm border border-indigo-100 text-indigo-700 text-sm font-medium mb-6 shadow-sm">
          <Sparkles className="w-4 h-4 text-orange-400" />
          Strategic Brief for Vantage Marketing
        </div>

        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 max-w-4xl mb-6 leading-[1.1]">
          Scale your campaign impact,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-orange-500">
            without the wait.
          </span>
        </h1>

        <p className="text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed font-light">
          A bespoke approach for Vantage to launch on-brand ABM hubs and personalized campaigns in minutes, freeing your team from the web queue.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-20 z-10 relative">
          <button className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-full font-medium shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-300">
            Talk through your goals
          </button>
          <button className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-full font-medium shadow-sm hover:bg-slate-50 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
            <PlayCircle className="w-5 h-5 text-indigo-500" />
            See it in action
          </button>
        </div>

        {/* Tactile Brief Chips */}
        <div className="max-w-4xl mx-auto w-full bg-white/60 backdrop-blur-md rounded-3xl p-6 lg:p-8 border border-white shadow-xl shadow-slate-100/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6 text-left ml-2">Strategy Overview</p>
          <div className="flex flex-wrap gap-3 justify-start">
            <BriefChip icon={Building} label="Account" value="Vantage" />
            <BriefChip icon={Target} label="Segment" value="Enterprise" />
            <BriefChip icon={Users} label="Audience" value="Marketing" />
            <BriefChip icon={BarChart3} label="Stage" value="Engaged" />
            <BriefChip icon={LayoutTemplate} label="Focus" value="ABM Pages" />
            <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl text-sm font-medium border border-indigo-100">
              <span className="flex -space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-200 border-2 border-white flex items-center justify-center text-[10px] font-bold">JM</span>
                <span className="w-6 h-6 rounded-full bg-violet-200 border-2 border-white flex items-center justify-center text-[10px] font-bold">PS</span>
                <span className="w-6 h-6 rounded-full bg-orange-200 border-2 border-white flex items-center justify-center text-[10px] font-bold">ML</span>
              </span>
              <span className="ml-1">LP Studio Team</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why this matters now */}
      <section id="overview" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why this matters now for Vantage</h2>
            <p className="text-slate-600 text-lg font-light">As you expand your ABM strategy, the bottleneck isn't ideas—it's execution.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <NarrativeCard 
              number="01"
              title="Campaign volume is rising"
              desc="More targeted accounts mean more personalized hubs. Scaling this output manually breaks the current process."
            />
            <NarrativeCard 
              number="02"
              title="Brand consistency is harder"
              desc="When reps try to build their own pages or use disconnected tools, the Vantage brand narrative fragments."
            />
            <NarrativeCard 
              number="03"
              title="Queues slow you down"
              desc="Waiting weeks for web and design resources means missing the window of intent for key accounts."
            />
          </div>
        </div>
      </section>

      {/* Recommended approach */}
      <section id="approach" className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5">
              <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-6">Our recommended approach</h2>
              <p className="text-lg text-slate-600 font-light mb-8">A connected workflow that keeps marketing in control of the brand, while empowering revenue teams to move fast.</p>
              
              <div className="space-y-8">
                <ApproachStep 
                  number="1"
                  title="Start with governed templates"
                  desc="Marketing creates locked-down templates for ABM, events, and content hubs."
                />
                <ApproachStep 
                  number="2"
                  title="Personalize at scale"
                  desc="Reps spin up specific versions for accounts, audiences, and stages in minutes."
                />
                <ApproachStep 
                  number="3"
                  title="Connect the follow-through"
                  desc="Insights and engagements flow directly back into your CRM and marketing automation."
                />
              </div>
            </div>
            
            <div className="lg:col-span-7">
              <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-100 relative">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500/20 to-orange-500/20 rounded-[2rem] blur -z-10" />
                <div className="aspect-[4/3] bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden">
                  {/* Abstract representation of workflow */}
                  <div className="w-full h-full p-8 flex flex-col justify-between">
                    <div className="flex justify-between items-center opacity-50">
                      <div className="w-24 h-4 bg-slate-200 rounded-full" />
                      <div className="flex gap-2">
                        <div className="w-8 h-8 bg-slate-200 rounded-full" />
                        <div className="w-8 h-8 bg-slate-200 rounded-full" />
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-6 my-8">
                      <div className="w-1/3 h-full bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center p-4">
                        <Library className="w-12 h-12 text-indigo-300" />
                      </div>
                      <ArrowRight className="w-6 h-6 text-slate-300" />
                      <div className="w-1/3 h-full bg-white rounded-xl shadow-sm border border-indigo-100 flex items-center justify-center p-4 ring-2 ring-indigo-500/20">
                        <Layers className="w-12 h-12 text-indigo-500" />
                      </div>
                    </div>
                    <div className="h-24 bg-white rounded-xl shadow-sm border border-slate-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Relevant Use Cases */}
      <section id="use-cases" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">High-impact plays for Vantage</h2>
              <p className="text-slate-600 text-lg font-light">Where we see the most immediate value for your marketing and sales teams.</p>
            </div>
            <button className="text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1">
              View all templates <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <UseCaseCard 
              title="ABM Account Pages"
              desc="1:1 tailored hubs containing personalized messaging, relevant case studies, and dedicated account team context."
              team="Sales & Marketing"
              cta="Explore ABM"
              icon={Target}
            />
            <UseCaseCard 
              title="Webinar Hubs"
              desc="Registration pages, on-demand video libraries, and resource collections from your digital events."
              team="Demand Gen"
              cta="See Webinar Hubs"
              icon={PlayCircle}
            />
            <UseCaseCard 
              title="Content Collections"
              desc="Curated asset bundles, podcast series, and thematic resource centers grouped by buyer persona."
              team="Content Marketing"
              cta="View Content Pages"
              icon={Library}
            />
          </div>
        </div>
      </section>

      {/* Audience Value & Proof */}
      <section id="proof" className="py-24 bg-slate-900 text-white rounded-[3rem] mx-4 lg:mx-8 mb-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/20 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-500/10 blur-[100px] rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20">
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-white leading-tight">
                Campaign-ready in minutes.
              </h2>
              <ul className="space-y-6 mb-12">
                {[
                  "Maintain strict brand consistency",
                  "Governed starting templates",
                  "Launch microsites in under 10 minutes",
                  "Reuse top-performing content automatically",
                  "Zero dependency on the web queue"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="mt-1 bg-white/10 rounded-full p-1">
                      <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-lg text-slate-300 font-light">{item}</span>
                  </li>
                ))}
              </ul>
              
              <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
                <p className="text-xl leading-relaxed italic text-slate-200 mb-6">
                  "LP Studio completely transformed how we run ABM. We used to ship 2 account pages a month. Now our reps spin up 50+ personalized pages a week, all perfectly on-brand."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold">SM</div>
                  <div>
                    <div className="font-semibold">Sarah Mitchell</div>
                    <div className="text-slate-400 text-sm">VP Marketing, Enterprise SaaS</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 justify-center">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                  <div className="text-4xl font-bold text-white mb-2">75%</div>
                  <div className="text-slate-400 text-sm">Faster page launches</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                  <div className="text-4xl font-bold text-white mb-2">3x</div>
                  <div className="text-slate-400 text-sm">More campaign variations</div>
                </div>
                <div className="bg-indigo-500/20 border border-indigo-400/30 rounded-3xl p-8 backdrop-blur-sm col-span-2">
                  <div className="text-5xl font-bold text-indigo-300 mb-2">42%</div>
                  <div className="text-indigo-200 text-sm">Increase in account engagement rates</div>
                </div>
              </div>
              
              <div className="h-48 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden relative group cursor-pointer">
                 <img src="/__mockup/images/abm-warm-spotlight-bg.png" className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale mix-blend-overlay group-hover:scale-105 transition-transform duration-700" alt="" />
                 <div className="absolute inset-0 bg-slate-900/40" />
                 <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 z-10 group-hover:bg-indigo-600 transition-colors">
                   <PlayCircle className="w-8 h-8 ml-1" />
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Action Plan & Team */}
      <section id="team" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid lg:grid-cols-2 gap-20">
            {/* Mutual Action Plan */}
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Mutual Action Plan</h2>
              <p className="text-slate-500 mb-10">Suggested next steps for the Vantage evaluation team.</p>
              
              <div className="relative border-l-2 border-slate-100 ml-4 space-y-10 pb-4">
                <ActionStep 
                  status="done"
                  title="Initial alignment"
                  desc="Reviewed current bottlenecks in campaign creation."
                />
                <ActionStep 
                  status="current"
                  title="Review strategic brief"
                  desc="You are here. Evaluate the proposed approach for Vantage."
                />
                <ActionStep 
                  status="next"
                  title="Select pilot use case"
                  desc="Identify the first ABM or event campaign to test."
                />
                <ActionStep 
                  status="next"
                  title="Technical deep dive"
                  desc="Review integration with your current marketing stack."
                />
              </div>
            </div>

            {/* Account Team */}
            <div>
              <div className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Your LP Studio Team</h2>
                <p className="text-slate-500 mb-10">We're here to help Vantage evaluate, implement, and scale.</p>
                
                <div className="space-y-6">
                  <TeamMember 
                    initials="JM"
                    name="Jordan Mills"
                    role="Account Executive"
                    desc="Your main point of contact for pricing, contracts, and overall strategy."
                    color="bg-indigo-100 text-indigo-700"
                  />
                  <TeamMember 
                    initials="PS"
                    name="Priya Shah"
                    role="Business Development"
                    desc="Helping coordinate resources, examples, and answers to initial questions."
                    color="bg-violet-100 text-violet-700"
                  />
                  <TeamMember 
                    initials="ML"
                    name="Marcus Lee"
                    role="Solutions Consultant"
                    desc="Technical expert mapping LP Studio to your specific marketing stack."
                    color="bg-orange-100 text-orange-700"
                  />
                </div>
                
                <div className="mt-10 flex gap-4 pt-8 border-t border-slate-200">
                  <button className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    Email Team
                  </button>
                  <button className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Calendar className="w-4 h-4 opacity-70" />
                    Book a Time
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-slate-900 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-950/50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to talk through your goals?</h2>
          <p className="text-xl text-slate-300 font-light mb-10">
            Let's discuss how Vantage can deploy campaign-ready pages in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 rounded-full font-semibold shadow-lg shadow-white/10 hover:bg-slate-50 transition-all hover:scale-105 active:scale-95">
              Talk to Jordan
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-white/10 text-white border border-white/20 rounded-full font-medium hover:bg-white/20 transition-all">
              Review examples
            </button>
          </div>
        </div>
      </section>
      
      <footer className="py-8 bg-slate-950 border-t border-white/10 text-center text-slate-500 text-sm">
         Prepared securely for Vantage. Powered by LP Studio.
      </footer>
    </div>
  );
}

// Subcomponents

function BriefChip({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow cursor-default">
      <Icon className="w-4 h-4 text-slate-400" />
      <span className="text-xs font-medium text-slate-500">{label}:</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function NarrativeCard({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-lg hover:border-slate-200 transition-all duration-300">
      <div className="text-sm font-bold text-indigo-400 mb-6">{number}</div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 font-light leading-relaxed">{desc}</p>
    </div>
  );
}

function ApproachStep({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="flex gap-6 group">
      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-lg font-bold text-slate-800 shadow-sm group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all duration-300 shrink-0">
        {number}
      </div>
      <div>
        <h4 className="text-xl font-bold text-slate-900 mb-2">{title}</h4>
        <p className="text-slate-600 font-light leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function UseCaseCard({ title, desc, team, cta, icon: Icon }: any) {
  return (
    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col group hover:shadow-xl hover:bg-white hover:-translate-y-1 transition-all duration-300 cursor-pointer">
      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm mb-6 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
        <Icon className="w-5 h-5 text-slate-700 group-hover:text-indigo-600" />
      </div>
      <div className="text-xs font-semibold text-indigo-500 mb-2">{team}</div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 font-light leading-relaxed mb-8 flex-1">{desc}</p>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800 group-hover:text-indigo-600 transition-colors mt-auto">
        {cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}

function ActionStep({ status, title, desc }: { status: "done" | "current" | "next", title: string, desc: string }) {
  return (
    <div className="relative pl-8">
      {status === "done" && (
        <div className="absolute left-[-21px] top-0 w-10 h-10 bg-indigo-50 rounded-full border-[3px] border-white flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-indigo-600" />
        </div>
      )}
      {status === "current" && (
        <div className="absolute left-[-17px] top-1 w-8 h-8 bg-indigo-600 rounded-full border-[4px] border-white shadow-sm flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
      )}
      {status === "next" && (
        <div className="absolute left-[-13px] top-2 w-6 h-6 bg-slate-100 rounded-full border-[4px] border-white" />
      )}
      <h4 className={`text-lg font-bold ${status === "next" ? "text-slate-500" : "text-slate-900"} mb-1`}>{title}</h4>
      <p className="text-slate-500 font-light">{desc}</p>
    </div>
  );
}

function TeamMember({ initials, name, role, desc, color }: any) {
  return (
    <div className="flex gap-5 items-start p-4 rounded-2xl hover:bg-white transition-colors cursor-default border border-transparent hover:border-slate-100 hover:shadow-sm">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 ${color}`}>
        {initials}
      </div>
      <div>
        <div className="font-bold text-slate-900 text-lg">{name}</div>
        <div className="text-indigo-600 font-medium text-sm mb-2">{role}</div>
        <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
