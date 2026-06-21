import { useEffect, useState } from "react";
import {
  Play, Calendar, ArrowRight, Check, Linkedin, ChevronDown,
  Video, FileText, Download, Sparkles, PlayCircle, Share2
} from "lucide-react";
import "./_group.css";

/* ------------------------------------------------------------------ */
/* Editable template config */
/* ------------------------------------------------------------------ */

type EventStatus = "upcoming" | "live" | "on-demand";

const webinarConfig = {
  brand: "Pipeline Studio",
  status: "upcoming" as EventStatus,
  title: "How Modern Teams Turn Content Into Pipeline",
  subtitle: "Join a tactical session on building webinar, podcast, and campaign hubs that keep working long after the live event ends.",
  date: "Thursday, July 17, 2026",
  time: "11:00 AM – 12:00 PM",
  timezone: "ET",
  registrations: 1842,
  nav: ["Overview", "Speakers", "Agenda", "Resources", "FAQ"],
  speakers: [
    { id: "maya-chen", name: "Maya Chen", role: "VP Marketing, Northwind", bio: "Built a content engine that sources 40% of pipeline. Obsessed with assets that compound.", initials: "MC", tint: "#2A3C34" },
    { id: "dev-okafor", name: "Dev Okafor", role: "Head of Demand, Lumen", bio: "Runs always-on webinar programs across three regions. Former RevOps lead.", initials: "DO", tint: "#8C4A32" },
    { id: "sara-lind", name: "Sara Lind", role: "Founder, Studio Method", bio: "Advises B2B teams on turning live events into evergreen demand surfaces.", initials: "SL", tint: "#DDA25D" },
  ],
  agenda: [
    { time: "11:00", title: "Welcome & framing", desc: "Why one-off webinars leak pipeline — and the hub model that fixes it.", speaker: "Maya Chen" },
    { time: "11:08", title: "Main presentation", desc: "The promotion → live → replay → follow-up loop, built once and reused everywhere.", speaker: "Dev Okafor" },
    { time: "11:35", title: "Customer breakdown", desc: "A teardown of a hub that sourced 1,200 MQLs from a single recorded session.", speaker: "Sara Lind" },
    { time: "11:50", title: "Live Q&A", desc: "Bring your questions — we answer as many as we can before time.", speaker: "All speakers" },
  ],
  resources: [
    { title: "The Webinar Hub Playbook", format: "Slide deck", desc: "The full framework from the session, ready to share internally.", icon: "deck" },
    { title: "From Event to Evergreen", format: "Guide", desc: "A step-by-step guide to converting live sessions into always-on demand.", icon: "guide" },
    { title: "Pre-Launch Checklist", format: "Checklist", desc: "Everything to ship before, during, and after a webinar.", icon: "checklist" },
    { title: "Northwind Pipeline Story", format: "Case study", desc: "How one team turned a quarterly webinar into 40% of sourced pipeline.", icon: "case" },
    { title: "Why Hubs Beat Pages", format: "Article", desc: "The short read on why a campaign hub outperforms a registration page.", icon: "article" },
  ],
  faqs: [
    { q: "Is the webinar live or on-demand?", a: "It runs live with full Q&A, then converts automatically into an on-demand replay you can watch anytime." },
    { q: "Will I get the recording?", a: "Yes. Everyone who registers gets the replay, slides, and resources by email — whether or not you attend live." },
    { q: "Can I share this with my team?", a: "Absolutely. Forward the link or invite colleagues directly — the hub works for one person or a whole team." },
    { q: "How do I submit a question?", a: "During the live session you can submit questions in the Q&A panel. Before the event, just reply to your confirmation email." },
    { q: "Can I book a follow-up session?", a: "Yes — there's a 'Book a follow-up' option throughout the hub to set up a 1:1 with our team." },
  ],
  emails: {
    sender: "events@pipeline.studio",
    domain: "pipeline.studio",
    sequence: [
      { when: "On register", label: "Confirmation", desc: "Calendar invite + what to expect.", icon: "confirm" },
      { when: "24h before", label: "24-hour reminder", desc: "Quick nudge with the join link.", icon: "bell" },
      { when: "1h before", label: "1-hour reminder", desc: "Final reminder — we start soon.", icon: "clock" },
      { when: "After event", label: "Replay follow-up", desc: "Replay, slides, and next steps.", icon: "replay" },
    ],
  },
  topics: {
    ai: { sub: "A tactical session on using AI to turn webinars, podcasts, and content into compounding pipeline.", resource: "The AI Content Engine Playbook" },
    abm: { sub: "A tactical session on building account-based webinar and campaign hubs that route target accounts straight to pipeline.", resource: "The ABM Hub Playbook" },
    content: { sub: "A tactical session on building content hubs that keep generating demand long after the publish date.", resource: "The Evergreen Content Playbook" },
  },
};

const STATUS_META: Record<EventStatus, any> = {
  upcoming: { eyebrow: "Upcoming Event", kicker: "Reserve your place", cta: "Request Invitation", formCta: "Secure Registration", formSuccess: "You're confirmed. We've sent a calendar invitation and further details to your inbox.", videoLabel: "Trailer preview", accent: "var(--wh-accent-upcoming)", pulse: false },
  live: { eyebrow: "Live Broadcast", kicker: "Session in progress", cta: "Enter Broadcast", formCta: "Join Session", formSuccess: "Access granted. Launching the live secure broadcast environment.", videoLabel: "Live stream", accent: "var(--wh-accent-live)", pulse: true },
  "on-demand": { eyebrow: "On Demand", kicker: "Access the archive", cta: "Watch Recording", formCta: "Unlock Recording", formSuccess: "Archive unlocked. The full recording and associated materials are below.", videoLabel: "Archived recording", accent: "var(--wh-accent-ondemand)", pulse: false },
};

/* ------------------------------------------------------------------ */
/* Atoms */
/* ------------------------------------------------------------------ */

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`wh-mono text-[10px] uppercase tracking-[0.15em] opacity-60 ${className}`}>{children}</span>;
}

function StatusPill({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 backdrop-blur-md rounded-full border border-white/10 wh-mono text-[11px] uppercase tracking-widest text-white">
      <span className="relative flex items-center justify-center w-2 h-2">
        {m.pulse && <span className="absolute w-full h-full rounded-full opacity-60 animate-ping" style={{ background: m.accent }} />}
        <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: m.accent }} />
      </span>
      {m.eyebrow}
    </div>
  );
}

function Avatar({ initials, tint, size = 48 }: { initials: string; tint: string; size?: number }) {
  return (
    <div 
      className="flex items-center justify-center rounded-full wh-serif font-medium text-white relative overflow-hidden shrink-0 border border-black/10 shadow-inner"
      style={{ width: size, height: size, fontSize: size * 0.4, background: tint }}
    >
      <div className="wh-noise opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
      <span className="relative z-10">{initials}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections */
/* ------------------------------------------------------------------ */

function Hero({ status, topicSub }: { status: EventStatus; topicSub?: string }) {
  const m = STATUS_META[status];
  return (
    <section className="wh-bg-dark relative pt-32 pb-48 px-6 lg:px-12 overflow-hidden">
      <div className="wh-noise wh-noise-dark"></div>
      
      {/* Decorative bg light */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-[#D65A41]/10 via-[#244C3F]/5 to-transparent blur-3xl opacity-60 rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8 relative z-10">
        
        {/* Left: Copy */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center wh-animate-fade-up">
          <div className="mb-6 flex items-center gap-4">
            <StatusPill status={status} />
            <span className="wh-mono text-[11px] uppercase tracking-widest opacity-50">Edition 004</span>
          </div>
          <h1 className="wh-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-8">
            {webinarConfig.title}
          </h1>
          <p className="wh-sans text-lg sm:text-xl text-white/70 leading-relaxed mb-12 max-w-lg wh-delay-1 wh-animate-fade-up">
            {topicSub || webinarConfig.subtitle}
          </p>
          
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-8 border-t border-white/10 wh-delay-2 wh-animate-fade-up">
            <div>
              <MonoLabel>Date & Time</MonoLabel>
              <div className="mt-1 text-sm">{webinarConfig.date}</div>
              <div className="text-sm opacity-60">{webinarConfig.time} {webinarConfig.timezone}</div>
            </div>
            <div>
              <MonoLabel>Format</MonoLabel>
              <div className="mt-1 text-sm">{status === 'upcoming' ? 'Live Broadcast' : 'Archive'}</div>
              <div className="text-sm opacity-60">Interactive Q&A</div>
            </div>
            <div>
              <MonoLabel>{status === 'live' ? 'Watching now' : status === 'on-demand' ? 'Have attended' : 'Registered'}</MonoLabel>
              <div className="mt-1 text-sm flex items-center gap-2">
                {status === 'live' && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: m.accent }} />}
                {webinarConfig.registrations.toLocaleString()}
              </div>
              <div className="text-sm opacity-60">Across all teams</div>
            </div>
          </div>
        </div>

        {/* Right: Video Card & Form */}
        <div className="lg:col-span-6 xl:col-span-6 xl:col-start-7 relative">
          <div className="absolute top-8 left-12 right-0 bottom-0 border border-white/5 bg-white/[0.02] -z-10 translate-x-4 translate-y-4"></div>
          
          <div className="wh-cinematic-card p-2 sm:p-4 wh-delay-2 wh-animate-fade-up">
            <div className="wh-gradient-mesh"></div>
            <div className="relative aspect-[16/10] bg-black overflow-hidden flex flex-col items-center justify-center group cursor-pointer border border-white/10">
              <div className="wh-noise opacity-30"></div>
              {/* Play button */}
              <div className="relative z-10 w-20 h-20 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:bg-white/10">
                <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
              </div>
              <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
                <span className="wh-mono text-[10px] tracking-widest uppercase bg-black/50 px-2 py-1 backdrop-blur-md rounded-sm">
                  {m.videoLabel}
                </span>
                <span className="wh-mono text-[10px] tracking-widest opacity-50">
                  {webinarConfig.brand}
                </span>
              </div>
            </div>
          </div>
          
          {/* Overlapping form card (shifted down) */}
          <div className="relative z-20 w-11/12 ml-auto -mt-16 sm:-mt-24 wh-delay-3 wh-animate-fade-up">
            <RegistrationForm status={status} />
          </div>
        </div>
        
      </div>
    </section>
  );
}

function RegistrationForm({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  const [done, setDone] = useState(false);

  useEffect(() => { setDone(false); }, [status]);

  if (done) {
    return (
      <div className="wh-ticket-stub p-8 text-center bg-white border border-[#E6E1D6]">
        <div className="w-16 h-16 mx-auto mb-6 bg-[#244C3F]/10 text-[#244C3F] rounded-full flex items-center justify-center">
          <Check className="w-8 h-8" strokeWidth={2} />
        </div>
        <h3 className="wh-serif text-3xl text-black mb-3">
          {status === "live" ? "Access Granted" : status === "on-demand" ? "Archive Unlocked" : "Confirmed"}
        </h3>
        <p className="text-black/60 text-sm mb-8 leading-relaxed max-w-[260px] mx-auto">{m.formSuccess}</p>
        <button onClick={() => setDone(false)} className="w-full py-4 bg-black text-white wh-mono text-[11px] uppercase tracking-widest hover:bg-black/80 transition-colors flex justify-center items-center gap-2">
          {status === "on-demand" ? "Play recording" : "Add to calendar"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setDone(true); }} className="wh-ticket-stub p-8 bg-white border border-[#E6E1D6]">
      <div className="mb-8">
        <MonoLabel className="text-black/40">{status === "on-demand" ? "Archive access" : "Secure your place"}</MonoLabel>
        <h3 className="mt-2 wh-serif text-3xl text-black leading-tight">
          {status === "on-demand" ? "Unlock the recording" : "Register for session"}
        </h3>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className="wh-input" placeholder="First name" required />
          <input className="wh-input" placeholder="Last name" required />
        </div>
        <input className="wh-input" type="email" placeholder="Work email" required />
        <input className="wh-input" placeholder="Company name" required />
      </div>
      <div className="wh-ticket-divider"></div>
      <button type="submit" className="w-full py-4 text-white wh-mono text-[11px] uppercase tracking-widest hover:opacity-90 transition-opacity flex justify-center items-center gap-2" style={{ background: m.accent }}>
        {m.formCta}
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}

function Workflow() {
  return (
    <section className="py-32 px-6 lg:px-12 bg-white relative">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          <div>
            <MonoLabel>The Lifecycle</MonoLabel>
            <h2 className="wh-serif text-4xl sm:text-5xl leading-[1.1] mt-4 mb-8">From registration to pipeline generation</h2>
            <p className="text-black/60 text-lg leading-relaxed max-w-md">
              We treat the live event as just the beginning. See how our automated sequence ensures no attendee is left behind, transitioning smoothly into evergreen demand.
            </p>
          </div>
          
          <div className="relative pl-8 sm:pl-12">
            {/* Spine */}
            <div className="absolute top-0 bottom-0 left-[15px] sm:left-[23px] w-px bg-[#E6E1D6]"></div>
            
            <div className="space-y-12 relative z-10">
              {webinarConfig.emails.sequence.map((step, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[38px] sm:-left-[46px] top-1 w-8 h-8 rounded-full bg-white border border-[#E6E1D6] flex items-center justify-center text-[10px] wh-mono font-bold">
                    0{i+1}
                  </div>
                  <div>
                    <span className="wh-mono text-[10px] uppercase tracking-widest text-[#D65A41]">{step.when}</span>
                    <h4 className="text-lg font-medium mt-1 mb-2">{step.label}</h4>
                    <p className="text-black/60 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Agenda() {
  return (
    <section className="py-32 px-6 lg:px-12 bg-[#F4F1ED]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-20">
          <MonoLabel>Itinerary</MonoLabel>
          <h2 className="wh-serif text-4xl sm:text-5xl mt-4">Session Agenda</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {webinarConfig.agenda.map((item, i) => (
            <div key={i} className="wh-hover-card bg-white p-8 border border-[#E6E1D6] flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-black/5"></div>
              <div className="wh-mono text-3xl font-light text-black/20 mb-6">{item.time}</div>
              <h4 className="text-xl font-medium mb-3">{item.title}</h4>
              <p className="text-black/60 text-sm leading-relaxed mb-8 flex-1">{item.desc}</p>
              
              <div className="pt-6 border-t border-[#E6E1D6] mt-auto flex items-center gap-3">
                <Avatar initials={item.speaker.split(' ').map(n=>n[0]).join('')} tint="#1A1A1A" size={24} />
                <span className="text-xs font-medium">{item.speaker}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Speakers({ highlightId }: { highlightId?: string | null }) {
  return (
    <section className="py-32 px-6 lg:px-12 bg-white border-y border-[#E6E1D6]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-baseline mb-20 gap-8">
          <div>
            <MonoLabel>The Panel</MonoLabel>
            <h2 className="wh-serif text-4xl sm:text-5xl mt-4">Industry Experts</h2>
          </div>
          <p className="text-black/60 max-w-xs md:text-right">Hear directly from leaders who have built revenue-driving content engines.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-16">
          {webinarConfig.speakers.map((s) => {
            const highlighted = highlightId === s.id;
            return (
            <div key={s.id} className={`group relative ${highlighted ? 'lg:-mt-4' : ''}`}>
              {highlighted && <div className="absolute -inset-4 sm:-inset-6 border border-[#D65A41]/40 rounded-sm -z-10"></div>}
              <div className="mb-6 relative inline-block">
                <Avatar initials={s.initials} tint={s.tint} size={120} />
                <div className="absolute bottom-0 right-0 bg-[#0A66C2] text-white p-2 rounded-full border-2 border-white transition-transform group-hover:scale-110">
                  <Linkedin className="w-4 h-4" />
                </div>
              </div>
              {highlighted && (
                <span className="inline-block mb-3 px-2 py-1 wh-mono text-[10px] uppercase tracking-widest text-white rounded-sm" style={{ background: "#D65A41" }}>Featured for you</span>
              )}
              <h3 className="wh-serif text-2xl mb-1">{s.name}</h3>
              <p className="wh-mono text-[11px] uppercase tracking-widest text-[#D65A41] mb-4">{s.role}</p>
              <p className="text-black/70 text-sm leading-relaxed">{s.bio}</p>
            </div>
          );})}
        </div>
      </div>
    </section>
  );
}

function FeaturedVideo({ status, initialTab = 0 }: { status: EventStatus; initialTab?: number }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const tabs = ["Full Recording", "Executive Summary", "Slides", "Transcript", "Related"];
  
  if (status !== 'on-demand') return null;
  
  return (
    <section className="py-32 px-6 lg:px-12 bg-black text-white relative">
      <div className="wh-noise opacity-10 mix-blend-overlay"></div>
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-16">
          <MonoLabel className="text-white/50">The Archive</MonoLabel>
          <h2 className="wh-serif text-4xl sm:text-5xl mt-4">Session Materials</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Stage */}
          <div className="lg:col-span-8">
            <div className="wh-cinematic-card aspect-video flex items-center justify-center mb-6">
              <div className="wh-noise opacity-20"></div>
              <div className="text-center">
                <PlayCircle className="w-16 h-16 mx-auto mb-4 opacity-50 hover:opacity-100 transition-opacity cursor-pointer" />
                <p className="wh-mono text-[11px] tracking-widest uppercase opacity-50">Press to play</p>
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="lg:col-span-4">
            <div className="border-b border-white/10 pb-4 mb-6">
              <h4 className="text-lg font-medium">{tabs[activeTab]}</h4>
            </div>
            <div className="flex flex-col gap-2">
              {tabs.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  className={`text-left px-4 py-3 text-sm wh-mono tracking-wider transition-colors border-l-2 ${
                    activeTab === i 
                      ? "border-[#D65A41] bg-white/5 text-white" 
                      : "border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.02]"
                  }`}
                >
                  0{i+1} — {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Resources({ featuredResource }: { featuredResource?: string }) {
  return (
    <section className="py-32 px-6 lg:px-12 bg-[#F4F1ED]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <MonoLabel>Library</MonoLabel>
            <h2 className="wh-serif text-4xl sm:text-5xl mt-4">Featured Resources</h2>
          </div>
          <button className="text-sm border-b border-black pb-1 hover:text-[#D65A41] hover:border-[#D65A41] transition-colors inline-flex items-center gap-2">
            View all materials <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredResource && (
            <div className="bg-black text-white p-6 wh-hover-card group cursor-pointer flex flex-col relative overflow-hidden">
              <div className="wh-noise opacity-10"></div>
              <div className="flex justify-between items-start mb-12 relative z-10">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <MonoLabel className="text-white/60">Recommended</MonoLabel>
              </div>
              <h4 className="text-lg font-medium mb-2 relative z-10">{featuredResource}</h4>
              <p className="text-white/60 text-sm leading-relaxed mb-6 flex-1 relative z-10">Hand-picked for you based on your interest. Start here.</p>
              <div className="flex justify-end relative z-10">
                <Download className="w-4 h-4" />
              </div>
            </div>
          )}
          {webinarConfig.resources.map((res, i) => (
            <div key={i} className="bg-white p-6 border border-[#E6E1D6] wh-hover-card group cursor-pointer flex flex-col">
              <div className="flex justify-between items-start mb-12">
                <div className="w-10 h-10 rounded-full bg-[#F4F1ED] flex items-center justify-center text-black/60 group-hover:bg-black group-hover:text-white transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
                <MonoLabel>{res.format}</MonoLabel>
              </div>
              <h4 className="text-lg font-medium mb-2 group-hover:text-[#D65A41] transition-colors">{res.title}</h4>
              <p className="text-black/60 text-sm leading-relaxed mb-6 flex-1">{res.desc}</p>
              <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <Download className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-32 px-6 lg:px-12 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-20">
          <MonoLabel>Information</MonoLabel>
          <h2 className="wh-serif text-4xl sm:text-5xl mt-4">Common Questions</h2>
        </div>
        
        <div className="border-t border-[#E6E1D6]">
          {webinarConfig.faqs.map((faq, i) => (
            <div key={i} className="border-b border-[#E6E1D6]">
              <button 
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full py-6 flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-6">
                  <span className="wh-serif text-2xl text-black/20 group-hover:text-black transition-colors">Q{i+1}</span>
                  <h4 className="text-lg font-medium pr-8">{faq.q}</h4>
                </div>
                <ChevronDown className={`w-5 h-5 text-black/40 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${open === i ? 'max-h-40 pb-8' : 'max-h-0'}`}>
                <div className="pl-14 text-black/60 leading-relaxed max-w-2xl">
                  {faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TopNav({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 wh-nav-glass">
      <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-sm bg-white"></div>
          <span className="font-medium text-white tracking-wide">{webinarConfig.brand}</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {webinarConfig.nav.map(item => (
            <a key={item} href="#" className="wh-mono text-[11px] uppercase tracking-widest text-white/70 hover:text-white transition-colors">
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden sm:inline-flex items-center justify-center w-10 h-10 border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors" aria-label="Share event">
            <Share2 className="w-4 h-4" />
          </button>
          <button className="px-5 py-2.5 text-white wh-mono text-[11px] uppercase tracking-widest hover:opacity-90 transition-opacity" style={{ background: m.accent }}>
            {m.cta}
          </button>
        </div>
      </div>
    </nav>
  );
}

function FinalCTA({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  const headline = status === "live" ? "The session is live right now" : status === "on-demand" ? "Watch the full session on your time" : "Save your seat before it fills";
  return (
    <section className="wh-bg-dark relative py-32 px-6 lg:px-12 overflow-hidden text-center">
      <div className="wh-noise wh-noise-dark"></div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-40 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(214,90,65,0.3), transparent 70%)" }}></div>
      <div className="max-w-3xl mx-auto relative z-10">
        <MonoLabel className="text-white/50">{m.kicker}</MonoLabel>
        <h2 className="wh-serif text-4xl sm:text-6xl mt-6 mb-8 leading-[1.05]">{headline}</h2>
        <p className="text-white/60 text-lg mb-12 max-w-xl mx-auto">{webinarConfig.subtitle}</p>
        <button className="px-8 py-4 text-white wh-mono text-[11px] uppercase tracking-widest hover:opacity-90 transition-opacity inline-flex items-center gap-2" style={{ background: m.accent }}>
          {m.cta} <ArrowRight className="w-4 h-4" />
        </button>
        <p className="wh-mono text-[10px] uppercase tracking-widest text-white/40 mt-8">
          {webinarConfig.registrations.toLocaleString()} {status === "live" ? "watching now" : status === "on-demand" ? "have attended" : "already registered"}
        </p>
      </div>
    </section>
  );
}

function Footer({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  return (
    <footer className="bg-black text-white py-20 px-6 lg:px-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h2 className="wh-serif text-3xl mb-4">{webinarConfig.brand}</h2>
          <p className="text-white/50 text-sm">Building better campaign experiences.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <button className="px-6 py-3 text-white wh-mono text-[11px] uppercase tracking-widest hover:opacity-90 transition-opacity inline-flex items-center gap-2" style={{ background: m.accent }}>
            {m.cta} <ArrowRight className="w-4 h-4" />
          </button>
          <div className="flex gap-4">
            <MonoLabel className="text-white/40">© 2026</MonoLabel>
            <MonoLabel className="text-white/40">Privacy Policy</MonoLabel>
            <MonoLabel className="text-white/40">Terms</MonoLabel>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FloatingToggle({ status, setStatus }: { status: EventStatus; setStatus: (s: EventStatus) => void }) {
  const opts: EventStatus[] = ["upcoming", "live", "on-demand"];
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 bg-black/80 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
      {opts.map(o => (
        <button
          key={o}
          onClick={() => setStatus(o)}
          className={`px-4 py-2 rounded-full wh-mono text-[10px] uppercase tracking-widest transition-all ${
            status === o ? 'bg-white text-black' : 'text-white/60 hover:text-white'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function WebinarHub() {
  // Fake URL param logic for preview / personalization
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const topicParam = searchParams.get('topic') as keyof typeof webinarConfig.topics | null;
  const topicData = topicParam ? webinarConfig.topics[topicParam] : null;
  const replayParam = searchParams.get('replay') === 'true';
  const speakerParam = searchParams.get('speaker');
  const resourceParam = searchParams.get('resource');

  const [status, setStatus] = useState<EventStatus>(replayParam ? 'on-demand' : webinarConfig.status);
  const initialTab = resourceParam === 'slides' ? 2 : 0;

  return (
    <div className="wh-wrapper relative min-h-screen">
      <TopNav status={status} />
      <Hero status={status} topicSub={topicData?.sub} />
      <Workflow />
      <Agenda />
      <FeaturedVideo status={status} initialTab={initialTab} />
      <Speakers highlightId={speakerParam} />
      <Resources featuredResource={topicData?.resource} />
      <FAQ />
      <FinalCTA status={status} />
      <Footer status={status} />
      <FloatingToggle status={status} setStatus={setStatus} />
    </div>
  );
}
