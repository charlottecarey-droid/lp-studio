import { useEffect, useMemo, useState } from "react";
import {
  Play,
  Calendar,
  Clock,
  Users,
  ArrowRight,
  Check,
  Linkedin,
  ChevronDown,
  Radio,
  Video,
  FileText,
  Download,
  MessageSquare,
  Mail,
  Bell,
  Globe,
  Sparkles,
  CalendarPlus,
  CircleHelp,
  BookOpen,
  ClipboardCheck,
  Newspaper,
  PlayCircle,
  Layers,
  Send,
  ShieldCheck,
  Quote,
  MoveRight
} from "lucide-react";

import "./_group.css";

/* ------------------------------------------------------------------ */
/* Editable template config — this is what would become LP Studio fields */
/* ------------------------------------------------------------------ */

type EventStatus = "upcoming" | "live" | "on-demand";

const webinarConfig = {
  brand: "Pipeline Studio",
  status: "upcoming" as EventStatus,
  title: "How Modern Teams Turn Content Into Pipeline",
  subtitle:
    "Join a tactical session on building webinar, podcast, and campaign hubs that keep working long after the live event ends.",
  date: "Thursday, July 17, 2026",
  time: "11:00 AM – 12:00 PM",
  timezone: "ET",
  registrations: 1842,
  nav: ["Overview", "Speakers", "Agenda", "Resources", "FAQ"],
  speakers: [
    {
      id: "maya-chen",
      name: "Maya Chen",
      role: "VP Marketing, Northwind",
      bio: "Built a content engine that sources 40% of pipeline. Obsessed with assets that compound.",
      initials: "MC",
      tint: "#255848", // Forest
    },
    {
      id: "dev-okafor",
      name: "Dev Okafor",
      role: "Head of Demand, Lumen",
      bio: "Runs always-on webinar programs across three regions. Former RevOps lead.",
      initials: "DO",
      tint: "#B9422F", // Terracotta
    },
    {
      id: "sara-lind",
      name: "Sara Lind",
      role: "Founder, Studio Method",
      bio: "Advises B2B teams on turning live events into evergreen demand surfaces.",
      initials: "SL",
      tint: "#8F7B66", // Taupe
    },
  ],
  agenda: [
    {
      time: "11:00",
      title: "Welcome & framing",
      desc: "Why one-off webinars leak pipeline — and the hub model that fixes it.",
      speaker: "Maya Chen",
    },
    {
      time: "11:08",
      title: "Main presentation",
      desc: "The promotion → live → replay → follow-up loop, built once and reused everywhere.",
      speaker: "Dev Okafor",
    },
    {
      time: "11:35",
      title: "Customer breakdown",
      desc: "A teardown of a hub that sourced 1,200 MQLs from a single recorded session.",
      speaker: "Sara Lind",
    },
    {
      time: "11:50",
      title: "Live Q&A",
      desc: "Bring your questions — we answer as many as we can before time.",
      speaker: "All speakers",
    },
  ],
  resources: [
    {
      title: "The Webinar Hub Playbook",
      format: "Slide deck",
      desc: "The full framework from the session, ready to share internally.",
      icon: "deck",
    },
    {
      title: "From Event to Evergreen",
      format: "Guide",
      desc: "A step-by-step guide to converting live sessions into always-on demand.",
      icon: "guide",
    },
    {
      title: "Pre-Launch Checklist",
      format: "Checklist",
      desc: "Everything to ship before, during, and after a webinar.",
      icon: "checklist",
    },
    {
      title: "Northwind Pipeline Story",
      format: "Case study",
      desc: "How one team turned a quarterly webinar into 40% of sourced pipeline.",
      icon: "case",
    },
    {
      title: "Why Hubs Beat Pages",
      format: "Article",
      desc: "The short read on why a campaign hub outperforms a registration page.",
      icon: "article",
    },
  ],
  faqs: [
    {
      q: "Is the webinar live or on-demand?",
      a: "It runs live with full Q&A, then converts automatically into an on-demand replay you can watch anytime.",
    },
    {
      q: "Will I get the recording?",
      a: "Yes. Everyone who registers gets the replay, slides, and resources by email — whether or not you attend live.",
    },
    {
      q: "Can I share this with my team?",
      a: "Absolutely. Forward the link or invite colleagues directly — the hub works for one person or a whole team.",
    },
    {
      q: "How do I submit a question?",
      a: "During the live session you can submit questions in the Q&A panel. Before the event, just reply to your confirmation email.",
    },
    {
      q: "Can I book a follow-up session?",
      a: "Yes — there's a 'Book a follow-up' option throughout the hub to set up a 1:1 with our team.",
    },
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
    ai: {
      sub: "A tactical session on using AI to turn webinars, podcasts, and content into compounding pipeline — without the busywork.",
      resource: "The AI Content Engine Playbook",
    },
    abm: {
      sub: "A tactical session on building account-based webinar and campaign hubs that route target accounts straight to pipeline.",
      resource: "The ABM Hub Playbook",
    },
    content: {
      sub: "A tactical session on building content hubs that keep generating demand long after the publish date.",
      resource: "The Evergreen Content Playbook",
    },
  },
};

/* ------------------------------------------------------------------ */
/* Status-driven copy + accents                                        */
/* ------------------------------------------------------------------ */

const STATUS_META: Record<
  EventStatus,
  {
    eyebrow: string;
    kicker: string;
    cta: string;
    formCta: string;
    formSuccess: string;
    videoLabel: string;
    accent: string;
    soft: string;
    pulse: boolean;
  }
> = {
  upcoming: {
    eyebrow: "Upcoming Event",
    kicker: "Reserve your place",
    cta: "Request Invitation",
    formCta: "Secure Registration",
    formSuccess: "You're confirmed. We've sent a calendar invitation and further details to your inbox.",
    videoLabel: "Trailer preview",
    accent: "var(--accent-upcoming)",
    soft: "#F8EDE9",
    pulse: false,
  },
  live: {
    eyebrow: "Live Broadcast",
    kicker: "Session in progress",
    cta: "Enter Broadcast",
    formCta: "Join Session",
    formSuccess: "Access granted. Launching the live secure broadcast environment.",
    videoLabel: "Live stream",
    accent: "var(--accent-live)",
    soft: "#FAEBDA",
    pulse: true,
  },
  "on-demand": {
    eyebrow: "On Demand",
    kicker: "Access the archive",
    cta: "Watch Recording",
    formCta: "Unlock Recording",
    formSuccess: "Archive unlocked. The full recording and associated materials are below.",
    videoLabel: "Archived recording",
    accent: "var(--accent-ondemand)",
    soft: "#EAF1EF",
    pulse: false,
  },
};

/* ------------------------------------------------------------------ */
/* Small shared atoms                                                  */
/* ------------------------------------------------------------------ */

function Eyebrow({ children, dark = false, className = "" }: { children: React.ReactNode; dark?: boolean; className?: string }) {
  return (
    <span
      className={`font-mono uppercase tracking-[0.2em] text-[11.5px] font-semibold ${className}`}
      style={{
        color: dark ? "rgba(255,255,255,0.7)" : "var(--text-dim)",
      }}
    >
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-2.5 rounded-full px-4 py-1.5"
      style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.05em",
        color: m.accent,
        background: m.soft,
        textTransform: "uppercase",
        fontFamily: "'DM Mono', monospace"
      }}
    >
      <span className="relative flex items-center justify-center" style={{ width: 6, height: 6 }}>
        {m.pulse && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
            style={{ background: m.accent }}
          />
        )}
        <span className="relative inline-flex rounded-full" style={{ width: 6, height: 6, background: m.accent }} />
      </span>
      {m.eyebrow}
    </span>
  );
}

function Avatar({ initials, tint, size = 40, ring = false }: { initials: string; tint: string; size?: number; ring?: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-serif font-medium text-white shrink-0 relative overflow-hidden"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: tint,
        boxShadow: ring ? `0 0 0 3px var(--bg-base), 0 0 0 5px ${tint}40` : "none",
      }}
    >
      <div className="absolute inset-0 opacity-20" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 100%)" }}></div>
      <span className="relative z-10">{initials}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Floating demo toggle                                                */
/* ------------------------------------------------------------------ */

function FloatingToggle({ status, setStatus }: { status: EventStatus; setStatus: (s: EventStatus) => void }) {
  const opts: EventStatus[] = ["upcoming", "live", "on-demand"];
  const label: Record<EventStatus, string> = { upcoming: "Upcoming", live: "Live", "on-demand": "On-demand" };
  return (
    <div
      className="fixed z-50 flex items-center gap-1.5 rounded-full p-1.5 wh-glass-panel shadow-xl"
      style={{
        bottom: 30,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(25, 24, 22, 0.85)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <span className="px-3 font-mono text-[10px] tracking-widest text-white/50 uppercase" aria-hidden>
        Demo State
      </span>
      <div className="flex bg-white/5 rounded-full p-0.5">
        {opts.map((o) => {
          const active = o === status;
          return (
            <button
              key={o}
              onClick={() => setStatus(o)}
              className="rounded-full transition-all duration-300"
              style={{
                padding: "8px 18px",
                fontSize: 12,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
                color: active ? "#191816" : "rgba(255,255,255,0.7)",
                background: active ? "white" : "transparent",
                boxShadow: active ? "0 2px 10px rgba(0,0,0,0.2)" : "none"
              }}
            >
              {label[o]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero video card mockup (no external images)                         */
/* ------------------------------------------------------------------ */

function HeroVideoCard({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  return (
    <div
      className="relative rounded-2xl overflow-hidden wh-hover-lift group"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-soft)",
        boxShadow: "0 30px 60px -20px rgba(25, 24, 22, 0.08)",
      }}
    >
      {/* video surface */}
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: "16 / 10",
          background: `radial-gradient(100% 100% at 50% 0%, ${m.soft} 0%, var(--bg-surface-alt) 100%)`,
        }}
      >
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ backgroundImage: "linear-gradient(var(--text-ink) 1px, transparent 1px), linear-gradient(90deg, var(--text-ink) 1px, transparent 1px)", backgroundSize: "32px 32px" }}></div>
        
        {/* status chip */}
        <div className="absolute left-5 top-5 z-10">
          <StatusPill status={status} />
        </div>

        {/* play button */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div
            className="flex items-center justify-center rounded-full transition-all duration-500 group-hover:scale-110"
            style={{
              width: 88,
              height: 88,
              background: "rgba(255,255,255,0.9)",
              boxShadow: `0 0 0 1px rgba(0,0,0,0.05), 0 20px 40px -10px rgba(25, 24, 22, 0.15)`,
            }}
          >
            <Play style={{ width: 28, height: 28, color: "var(--text-ink)", marginLeft: 4 }} fill="var(--text-ink)" />
          </div>
        </div>

        {/* faux waveform / progress for on-demand */}
        {status === "on-demand" && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/5">
            <div className="h-full" style={{ width: "45%", background: m.accent }} />
          </div>
        )}
      </div>

      {/* meta footer */}
      <div className="p-6 md:p-8" style={{ background: "var(--bg-surface)" }}>
        <h3 className="font-serif text-xl md:text-2xl font-medium leading-tight" style={{ color: "var(--text-ink)" }}>
          {webinarConfig.title}
        </h3>
        <div className="mt-3 font-sans font-medium flex items-center gap-2" style={{ fontSize: 14, color: "var(--text-dim)" }}>
          <Calendar className="w-4 h-4 opacity-70" />
          <span>{webinarConfig.date}</span>
          <span className="mx-1 opacity-40">•</span>
          <span>{webinarConfig.time} {webinarConfig.timezone}</span>
        </div>
        
        <div className="mt-8 pt-6 border-t flex flex-wrap items-center justify-between gap-4" style={{ borderColor: "var(--border-soft)" }}>
          <div className="flex items-center">
            <div className="flex -space-x-3">
              {webinarConfig.speakers.map((s) => (
                <div key={s.id} className="relative transition-transform hover:-translate-y-1 z-0 hover:z-10">
                  <Avatar initials={s.initials} tint={s.tint} size={38} ring />
                </div>
              ))}
            </div>
            <div className="ml-4">
              <div className="text-[13px] font-semibold tracking-wide uppercase font-mono text-ink">Expert Panel</div>
              <div className="text-[13px] text-dim mt-0.5">{webinarConfig.speakers.length} Speakers</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: "var(--bg-surface-alt)" }}>
             <Users className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
             <span className="text-[13px] font-semibold font-mono" style={{ color: "var(--text-ink)" }}>
               {webinarConfig.registrations.toLocaleString()} Attending
             </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Registration / access form                                          */
/* ------------------------------------------------------------------ */

function RegistrationForm({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(false);
  }, [status]);

  const field =
    "w-full rounded-sm border-b px-2 py-3.5 text-[15px] outline-none transition-all duration-300 font-sans";

  if (done) {
    return (
      <div
        className="rounded-2xl p-10 text-center relative overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-soft)", boxShadow: "0 20px 40px -20px rgba(25, 24, 22, 0.08)" }}
      >
        <div className="absolute top-0 left-0 w-full h-1" style={{ background: m.accent }}></div>
        <div
          className="mx-auto mb-8 flex items-center justify-center rounded-full"
          style={{ width: 72, height: 72, background: m.soft }}
        >
          <Check style={{ width: 32, height: 32, color: m.accent }} strokeWidth={2} />
        </div>
        <h3 className="font-serif text-3xl font-medium" style={{ color: "var(--text-ink)" }}>
          {status === "live" ? "Access Granted" : status === "on-demand" ? "Archive Unlocked" : "Registration Confirmed"}
        </h3>
        <p className="mx-auto mt-4 max-w-sm text-[16px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{m.formSuccess}</p>
        <button
          onClick={() => setDone(false)}
          className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[14px] font-semibold tracking-wide uppercase font-mono transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--text-ink)", color: "white" }}
        >
          {status === "on-demand" ? "Play recording" : "Add to calendar"}
          <MoveRight style={{ width: 16, height: 16 }} />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      className="rounded-2xl p-8 sm:p-10 relative overflow-hidden"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-soft)", boxShadow: "0 20px 40px -20px rgba(25, 24, 22, 0.08)" }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none" 
           style={{ background: `radial-gradient(circle at top right, ${m.accent}, transparent)` }}></div>
           
      <div className="mb-8">
        <Eyebrow>{status === "on-demand" ? "Archive access" : "Secure your place"}</Eyebrow>
        <h3 className="mt-3 font-serif text-3xl sm:text-4xl font-medium leading-tight" style={{ color: "var(--text-ink)" }}>
          {status === "on-demand" ? "Unlock the full recording" : "Register for the session"}
        </h3>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input className={field} style={{ borderColor: "var(--border-soft)", background: "transparent", color: "var(--text-ink)" }} placeholder="First name" required />
          <input className={field} style={{ borderColor: "var(--border-soft)", background: "transparent", color: "var(--text-ink)" }} placeholder="Last name" required />
        </div>
        <input className={field} style={{ borderColor: "var(--border-soft)", background: "transparent", color: "var(--text-ink)" }} type="email" placeholder="Work email address" required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input className={field} style={{ borderColor: "var(--border-soft)", background: "transparent", color: "var(--text-ink)" }} placeholder="Company name" required />
          <input className={field} style={{ borderColor: "var(--border-soft)", background: "transparent", color: "var(--text-ink)" }} placeholder="Job title" />
        </div>
      </div>
      
      <button
        type="submit"
        className="mt-10 flex w-full items-center justify-center gap-3 rounded-full py-4 text-[14px] font-bold tracking-wider uppercase font-mono text-white transition-all duration-300 hover:opacity-90 hover:shadow-lg"
        style={{ background: m.accent }}
      >
        {m.formCta}
        <MoveRight style={{ width: 16, height: 16 }} />
      </button>
      
      <p className="mt-6 flex items-center justify-center gap-2 text-center text-[13px] font-medium" style={{ color: "var(--text-dim)" }}>
        <ShieldCheck style={{ width: 14, height: 14, opacity: 0.6 }} />
        Materials sent to all registrants automatically.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Status-specific side panel                                          */
/* ------------------------------------------------------------------ */

function StatusPanel({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];

  if (status === "live") {
    return (
      <div className="space-y-6">
        <div
          className="relative overflow-hidden rounded-2xl border"
          style={{ aspectRatio: "16/9", background: "var(--text-ink)", borderColor: "rgba(255,255,255,0.1)" }}
        >
          <div className="absolute left-4 top-4 z-10">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase font-mono text-white"
              style={{ background: m.accent }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> LIVE
            </span>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
             <Video className="w-10 h-10 text-white mb-3" strokeWidth={1.5} />
             <div className="text-white font-mono text-xs uppercase tracking-widest">Broadcast Environment</div>
          </div>
        </div>
        
        <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-soft)" }}>
          <div className="flex items-center justify-between border-b pb-4 mb-4" style={{ borderColor: "var(--border-soft)" }}>
            <span className="font-serif font-medium text-lg" style={{ color: "var(--text-ink)" }}>
              Live Q&amp;A
            </span>
            <span className="text-[12px] font-mono tracking-wider" style={{ color: "var(--text-dim)" }}>312 JOINED</span>
          </div>
          <div className="space-y-5">
            {[
              ["AR", "Where do you host the live stream?", "#8F7B66"],
              ["TM", "Will this work for a 6-person team?", "#255848"],
            ].map(([i, q, color]) => (
              <div key={q} className="flex items-start gap-4">
                <Avatar initials={i} tint={color} size={32} />
                <p className="text-[14px] leading-relaxed pt-1" style={{ color: "var(--text-ink)" }}>{q}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <input
              className="flex-1 rounded-full border px-4 py-2.5 text-[14px] outline-none bg-transparent"
              style={{ borderColor: "var(--border-soft)", color: "var(--text-ink)" }}
              placeholder="Ask a question…"
            />
            <button className="rounded-full w-11 h-11 flex items-center justify-center text-white shrink-0 transition-transform hover:scale-105" style={{ background: "var(--text-ink)" }}>
              <Send style={{ width: 16, height: 16, marginLeft: -2 }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "on-demand") {
    return (
      <div className="space-y-6">
        <div
          className="relative overflow-hidden rounded-2xl group cursor-pointer"
          style={{ aspectRatio: "16/9", background: "var(--text-ink)" }}
        >
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\\'20\\' height=\\'20\\' viewBox=\\'0 0 20 20\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'%23ffffff\\' fill-opacity=\\'0.4\\' fill-rule=\\'evenodd\\'%3E%3Ccircle cx=\\'3\\' cy=\\'3\\' r=\\'3\\'/%3E%3Ccircle cx=\\'13\\' cy=\\'13\\' r=\\'3\\'/%3E%3C/g%3E%3C/svg%3E')", backgroundSize: "20px 20px" }}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="flex items-center justify-center rounded-full transition-transform duration-500 group-hover:scale-110"
              style={{ width: 72, height: 72, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <div className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "white" }}>
                <Play style={{ width: 20, height: 20, color: "var(--text-ink)", marginLeft: 4 }} fill="var(--text-ink)" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            className="flex items-center justify-center gap-2.5 rounded-full border py-3.5 text-[13px] font-bold uppercase tracking-wide font-mono transition-colors hover:bg-black/5"
            style={{ borderColor: "var(--border-soft)", background: "transparent", color: "var(--text-ink)" }}
          >
            <Download style={{ width: 16, height: 16 }} /> Presentation
          </button>
          <button
            className="flex items-center justify-center gap-2.5 rounded-full py-3.5 text-[13px] font-bold uppercase tracking-wide font-mono text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--text-ink)" }}
          >
            <Calendar style={{ width: 16, height: 16 }} /> Consultation
          </button>
        </div>
        
        <div className="rounded-2xl p-6" style={{ border: "1px solid var(--border-soft)", background: "var(--bg-surface)" }}>
          <Eyebrow>Archive Contents</Eyebrow>
          <ul className="mt-5 space-y-4">
            {["The hub model, end to end", "Northwind's 40% pipeline story", "Live Q&A highlights"].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[15px] font-medium" style={{ color: "var(--text-dim)" }}>
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: m.soft }}>
                  <Check style={{ width: 12, height: 12, color: m.accent }} strokeWidth={3} />
                </div>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // upcoming
  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-7 md:p-8" style={{ border: "1px solid var(--border-soft)", background: "var(--bg-surface)" }}>
        <h3 className="font-serif text-2xl font-medium mb-6" style={{ color: "var(--text-ink)" }}>Session Overview</h3>
        <ul className="space-y-5">
          {[
            "The hub model that keeps webinars working after the live date",
            "How to wire registration, reminders, and replay into one flow",
            "A teardown of a hub that sourced 40% of pipeline",
          ].map((t) => (
            <li key={t} className="flex items-start gap-4">
              <span
                className="mt-1 flex items-center justify-center rounded-full shrink-0"
                style={{ width: 28, height: 28, background: m.soft }}
              >
                <Check style={{ width: 14, height: 14, color: m.accent }} strokeWidth={2.5} />
              </span>
              <span className="text-[16px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{t}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div
        className="flex items-start gap-4 rounded-2xl p-6 relative overflow-hidden"
        style={{ background: m.soft }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle at top right, ${m.accent}, transparent)` }}></div>
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
          <Bell style={{ width: 18, height: 18, color: m.accent }} />
        </div>
        <div>
          <h4 className="font-serif text-lg font-medium mb-1" style={{ color: "var(--text-ink)" }}>Automated Reminders</h4>
          <p className="text-[14px] leading-relaxed opacity-80" style={{ color: "var(--text-ink)" }}>
            Register once. We handle calendar holds and send notifications 24h and 1h prior to broadcast.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workflow feature section                                            */
/* ------------------------------------------------------------------ */

const WORKFLOW_FEATURES: { icon: React.ReactNode; label: string }[] = [
  { icon: <FileText />, label: "Registration interface" },
  { icon: <CalendarPlus />, label: "Calendar integration" },
  { icon: <Bell />, label: "Reminder sequence" },
  { icon: <Video />, label: "Live broadcast" },
  { icon: <MessageSquare />, label: "Interactive Q&A" },
  { icon: <PlayCircle />, label: "Archival replay" },
  { icon: <Layers />, label: "Resource library" },
  { icon: <Globe />, label: "UTM tracking" },
];

const EMAIL_ICONS: Record<string, React.ReactNode> = {
  confirm: <Mail style={{ width: 18, height: 18 }} />,
  bell: <Bell style={{ width: 18, height: 18 }} />,
  clock: <Clock style={{ width: 18, height: 18 }} />,
  replay: <PlayCircle style={{ width: 18, height: 18 }} />,
};

function WorkflowSection() {
  return (
    <section className="px-6 py-32 border-t" style={{ background: "var(--bg-base)", borderColor: "var(--border-soft)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-4 lg:sticky lg:top-32">
            <Eyebrow>Architecture</Eyebrow>
            <h2
              className="mt-4 font-serif"
              style={{ fontSize: "clamp(36px,4vw,48px)", fontWeight: 500, lineHeight: 1.1, color: "var(--text-ink)" }}
            >
              Engineered for the full lifecycle.
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Beyond a simple registration form—this is a comprehensive campaign architecture. A single destination governs promotion, live interaction, archival access, and automated follow-up.
            </p>
          </div>
          
          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {WORKFLOW_FEATURES.map((f, i) => (
                <div
                  key={f.label}
                  className="rounded-2xl p-6 wh-hover-lift flex flex-col items-center text-center wh-animate-fade-up"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-soft)", animationDelay: `${i * 50}ms` }}
                >
                  <span className="flex items-center justify-center rounded-full mb-5" style={{ width: 48, height: 48, background: "var(--bg-surface-alt)", color: "var(--text-ink)" }}>
                    <span className="[&>svg]:h-[20px] [&>svg]:w-[20px] opacity-80">{f.icon}</span>
                  </span>
                  <div className="text-[14px] font-medium leading-snug" style={{ color: "var(--text-ink)" }}>{f.label}</div>
                </div>
              ))}
            </div>

            {/* email sequence */}
            <div className="mt-12 rounded-3xl p-8 md:p-10 relative overflow-hidden" style={{ background: "var(--text-ink)" }}>
              <div className="absolute right-0 bottom-0 w-64 h-64 opacity-5 pointer-events-none" style={{ background: "radial-gradient(circle, white, transparent 70%)" }}></div>
              
              <div className="flex flex-wrap items-center justify-between gap-6 mb-10 relative z-10">
                <div>
                  <Eyebrow dark>Communications</Eyebrow>
                  <h3 className="mt-3 font-serif text-2xl md:text-3xl text-white">
                    Automated engagement sequence
                  </h3>
                </div>
                <div className="flex items-center gap-2 rounded-full px-4 py-2 bg-white/10 border border-white/10 backdrop-blur-sm">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span className="font-mono text-[12px] tracking-wide text-white/80 uppercase">
                    {webinarConfig.emails.sender}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {webinarConfig.emails.sequence.map((e, i) => (
                  <div key={e.label} className="flex gap-5 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-white/10 text-white border border-white/5">
                      {EMAIL_ICONS[e.icon]}
                    </div>
                    <div>
                      <div className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-1">
                        Phase 0{i + 1} • {e.when}
                      </div>
                      <div className="text-[16px] font-medium text-white mb-1.5">{e.label}</div>
                      <p className="text-[14px] text-white/60 leading-relaxed">{e.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Agenda                                                              */
/* ------------------------------------------------------------------ */

function AgendaSection() {
  return (
    <section id="agenda" className="px-6 py-32 border-t" style={{ background: "var(--bg-surface)", borderColor: "var(--border-soft)" }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 text-center">
          <Eyebrow>Itinerary</Eyebrow>
          <h2 className="mt-4 font-serif" style={{ fontSize: "clamp(36px,4vw,48px)", fontWeight: 500, color: "var(--text-ink)" }}>
            A precise, structured hour.
          </h2>
        </div>
        
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute top-8 bottom-8 left-[39px] w-[1px] hidden md:block" style={{ background: "var(--border-soft)" }}></div>
          
          <div className="space-y-6">
            {webinarConfig.agenda.map((a, i) => (
              <div
                key={a.title}
                className="group relative flex flex-col gap-6 rounded-2xl p-6 md:p-8 md:flex-row md:items-start transition-colors hover:bg-black/[0.02]"
                style={{ border: "1px solid var(--border-soft)" }}
              >
                <div className="flex items-center gap-6 md:w-48 shrink-0 relative z-10">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full font-mono text-xl shrink-0" style={{ background: "var(--bg-base)", color: "var(--text-ink)", border: "1px solid var(--border-soft)" }}>
                    {a.time}
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="font-mono text-[12px] tracking-widest uppercase mb-3" style={{ color: "var(--text-dim)" }}>
                    Section 0{i + 1} <span className="mx-2 opacity-30">|</span> {a.speaker}
                  </div>
                  <h3 className="text-2xl font-serif font-medium mb-3" style={{ color: "var(--text-ink)" }}>{a.title}</h3>
                  <p className="text-[16px] leading-relaxed max-w-xl" style={{ color: "var(--text-dim)" }}>{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Speakers                                                            */
/* ------------------------------------------------------------------ */

function SpeakersSection({ highlight }: { highlight?: string }) {
  return (
    <section id="speakers" className="px-6 py-32 border-t" style={{ background: "var(--bg-base)", borderColor: "var(--border-soft)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 md:flex items-end justify-between gap-8">
          <div className="max-w-2xl">
            <Eyebrow>Faculty</Eyebrow>
            <h2 className="mt-4 font-serif" style={{ fontSize: "clamp(36px,4vw,48px)", fontWeight: 500, color: "var(--text-ink)" }}>
              Guided by practitioners.
            </h2>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {webinarConfig.speakers.map((s, i) => {
            const on = highlight === s.id;
            return (
              <div
                key={s.id}
                className="rounded-2xl p-8 relative overflow-hidden wh-hover-lift wh-animate-fade-up"
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${on ? s.tint : 'var(--border-soft)'}`,
                  boxShadow: on ? `0 10px 40px -10px ${s.tint}30` : "none",
                  animationDelay: `${i * 150}ms`
                }}
              >
                {on && (
                  <div className="absolute top-0 left-0 w-full h-1" style={{ background: s.tint }}></div>
                )}
                
                <div className="flex justify-between items-start mb-6">
                  <Avatar initials={s.initials} tint={s.tint} size={80} />
                  <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:bg-black/5" style={{ borderColor: "var(--border-soft)", color: "var(--text-dim)" }}>
                    <Linkedin style={{ width: 16, height: 16 }} />
                  </a>
                </div>
                
                <h3 className="text-2xl font-serif font-medium mb-1" style={{ color: "var(--text-ink)" }}>{s.name}</h3>
                <p className="text-[14px] font-mono uppercase tracking-wide mb-6" style={{ color: s.tint }}>
                  {s.role}
                </p>
                <div className="w-8 h-[1px] mb-6" style={{ background: "var(--border-soft)" }}></div>
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{s.bio}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Featured video module with tabs                                     */
/* ------------------------------------------------------------------ */

const VIDEO_TABS = [
  { id: "replay", label: "Full Recording", icon: <PlayCircle style={{ width: 16, height: 16 }} /> },
  { id: "highlight", label: "Executive Summary", icon: <Sparkles style={{ width: 16, height: 16 }} /> },
  { id: "slides", label: "Presentation Deck", icon: <FileText style={{ width: 16, height: 16 }} /> },
  { id: "transcript", label: "Full Transcript", icon: <Quote style={{ width: 16, height: 16 }} /> },
  { id: "related", label: "Related Sessions", icon: <Layers style={{ width: 16, height: 16 }} /> },
];

function VideoModule({ status, slidesFirst }: { status: EventStatus; slidesFirst?: boolean }) {
  const m = STATUS_META[status];
  const [tab, setTab] = useState(slidesFirst ? "slides" : "replay");
  
  useEffect(() => {
    setTab(slidesFirst ? "slides" : "replay");
  }, [slidesFirst]);

  return (
    <section className="px-6 py-32" style={{ background: "var(--text-ink)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <Eyebrow dark>Multimedia Archive</Eyebrow>
            <h2 className="mt-4 font-serif text-white" style={{ fontSize: "clamp(36px,4vw,48px)", fontWeight: 400 }}>
              {status === "live" ? "Live broadcast underway." : status === "on-demand" ? "Explore the full session." : "Preview the curriculum."}
            </h2>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {VIDEO_TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-mono tracking-wide uppercase transition-all duration-300"
                  style={{
                    background: active ? "white" : "transparent",
                    color: active ? "var(--text-ink)" : "rgba(255,255,255,0.6)",
                    border: active ? "1px solid white" : "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl group cursor-pointer"
          style={{ aspectRatio: "16/8", border: "1px solid rgba(255,255,255,0.15)", background: "#11100F" }}
        >
          {/* Cinematic lighting effect */}
          <div
            className="absolute inset-0 opacity-40 transition-opacity duration-700 group-hover:opacity-60"
            style={{ 
              background: `radial-gradient(120% 120% at 50% 100%, ${m.accent}40, transparent 60%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05), transparent 70%)` 
            }}
          />
          
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            {status === "live" && (
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-mono uppercase tracking-widest font-bold text-white shadow-lg" style={{ background: m.accent }}>
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE BROADCAST
              </span>
            )}
            
            <div className="flex items-center justify-center rounded-full transition-transform duration-500 group-hover:scale-110" 
                 style={{ width: 100, height: 100, background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-center rounded-full" style={{ width: 72, height: 72, background: "white" }}>
                {tab === "slides" ? (
                  <FileText style={{ width: 28, height: 28, color: "var(--text-ink)" }} />
                ) : tab === "transcript" ? (
                  <Quote style={{ width: 28, height: 28, color: "var(--text-ink)" }} />
                ) : tab === "related" ? (
                  <Layers style={{ width: 28, height: 28, color: "var(--text-ink)" }} />
                ) : (
                  <Play style={{ width: 32, height: 32, color: "var(--text-ink)", marginLeft: 4 }} fill="var(--text-ink)" />
                )}
              </div>
            </div>
            
            <div className="font-mono text-[13px] tracking-widest uppercase text-white/60">
              {VIDEO_TABS.find((t) => t.id === tab)?.label}
              {tab === "replay" && " • 58 MIN"}
              {tab === "highlight" && " • 03 MIN"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

const RES_ICON: Record<string, React.ReactNode> = {
  deck: <FileText strokeWidth={1.5} />,
  guide: <BookOpen strokeWidth={1.5} />,
  checklist: <ClipboardCheck strokeWidth={1.5} />,
  case: <Layers strokeWidth={1.5} />,
  article: <Newspaper strokeWidth={1.5} />,
};

function ResourcesSection({ featured }: { featured?: string }) {
  const list = useMemo(() => {
    const items = [...webinarConfig.resources];
    if (featured) {
      items.sort((a, b) => (a.title === featured ? -1 : b.title === featured ? 1 : 0));
    }
    return items;
  }, [featured]);

  return (
    <section id="resources" className="px-6 py-32 border-t" style={{ background: "var(--bg-base)", borderColor: "var(--border-soft)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 md:flex justify-between items-end">
          <div className="max-w-2xl">
            <Eyebrow>Library</Eyebrow>
            <h2 className="mt-4 font-serif" style={{ fontSize: "clamp(36px,4vw,48px)", fontWeight: 500, color: "var(--text-ink)" }}>
              Supplementary materials.
            </h2>
          </div>
          <button className="mt-6 md:mt-0 flex items-center gap-2 font-mono uppercase tracking-wide text-[13px] font-bold pb-1 border-b" style={{ color: "var(--text-ink)", borderColor: "var(--text-ink)" }}>
            Download All <Download className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r, i) => {
            const isFeatured = featured && r.title === featured && i === 0;
            return (
              <div
                key={r.title}
                className="group flex flex-col rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 wh-animate-fade-up"
                style={{ 
                  background: isFeatured ? "var(--text-ink)" : "var(--bg-surface)",
                  border: `1px solid ${isFeatured ? 'transparent' : 'var(--border-soft)'}`,
                  boxShadow: isFeatured ? "0 20px 40px -10px rgba(0,0,0,0.2)" : "none",
                  animationDelay: `${i * 100}ms`
                }}
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110" 
                       style={{ width: 56, height: 56, background: isFeatured ? "rgba(255,255,255,0.1)" : "var(--bg-surface-alt)", color: isFeatured ? "white" : "var(--text-ink)" }}>
                    <span className="[&>svg]:w-[24px] [&>svg]:h-[24px]">{RES_ICON[r.icon]}</span>
                  </div>
                  <span className="font-mono text-[11px] uppercase tracking-widest px-3 py-1 rounded-full border" 
                        style={{ color: isFeatured ? "white" : "var(--text-dim)", borderColor: isFeatured ? "rgba(255,255,255,0.2)" : "var(--border-soft)" }}>
                    {r.format}
                  </span>
                </div>
                
                <h3 className="text-xl font-serif font-medium mb-3" style={{ color: isFeatured ? "white" : "var(--text-ink)" }}>{r.title}</h3>
                <p className="flex-1 text-[15px] leading-relaxed" style={{ color: isFeatured ? "rgba(255,255,255,0.7)" : "var(--text-dim)" }}>{r.desc}</p>
                
                <div className="mt-8 pt-6 border-t flex items-center justify-between" style={{ borderColor: isFeatured ? "rgba(255,255,255,0.1)" : "var(--border-soft)" }}>
                  <span className="font-mono uppercase tracking-widest text-[12px] font-bold transition-transform group-hover:translate-x-1" 
                        style={{ color: isFeatured ? "white" : "var(--text-ink)" }}>
                    Access Document
                  </span>
                  <MoveRight className={`w-4 h-4 transition-transform group-hover:translate-x-2 ${isFeatured ? 'text-white' : 'text-ink'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="px-6 py-32 border-t" style={{ background: "var(--bg-surface)", borderColor: "var(--border-soft)" }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 text-center">
          <Eyebrow>Support</Eyebrow>
          <h2 className="mt-4 font-serif" style={{ fontSize: "clamp(36px,4vw,48px)", fontWeight: 500, color: "var(--text-ink)" }}>
            Common inquiries.
          </h2>
        </div>
        
        <div className="border-t" style={{ borderColor: "var(--border-soft)" }}>
          {webinarConfig.faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b" style={{ borderColor: "var(--border-soft)" }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-8 text-left group"
                >
                  <span className="text-xl font-serif font-medium transition-colors group-hover:opacity-70" style={{ color: "var(--text-ink)" }}>{f.q}</span>
                  <div className="flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300"
                       style={{ borderColor: "var(--border-soft)", background: isOpen ? "var(--text-ink)" : "transparent", color: isOpen ? "white" : "var(--text-ink)" }}>
                    <ChevronDown
                      style={{ width: 20, height: 20, transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)", transform: isOpen ? "rotate(180deg)" : "none" }}
                    />
                  </div>
                </button>
                <div 
                  className="overflow-hidden transition-all duration-500 ease-in-out" 
                  style={{ maxHeight: isOpen ? "200px" : "0", opacity: isOpen ? 1 : 0 }}
                >
                  <p className="pb-8 pr-12 text-[16px] leading-relaxed max-w-3xl" style={{ color: "var(--text-dim)" }}>{f.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA + footer                                                  */
/* ------------------------------------------------------------------ */

function FinalCta({ status, onCta }: { status: EventStatus; onCta: () => void }) {
  const m = STATUS_META[status];
  const headline =
    status === "live" ? "Enter the broadcast." : status === "on-demand" ? "Explore the archive." : "Confirm your attendance.";
    
  return (
    <section className="px-6 pt-32 pb-12" style={{ background: "var(--bg-base)" }}>
      <div
        className="mx-auto max-w-5xl rounded-[2rem] p-12 md:p-24 text-center relative overflow-hidden"
        style={{
          background: "var(--text-ink)",
        }}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-64 opacity-30 pointer-events-none" style={{ background: `radial-gradient(circle, ${m.accent}, transparent 70%)` }}></div>

        <div className="relative z-10">
          <div className="flex justify-center mb-8">
            <StatusPill status={status} />
          </div>
          <h2 className="mx-auto max-w-3xl font-serif text-white" style={{ fontSize: "clamp(40px,6vw,72px)", fontWeight: 400, lineHeight: 1.05 }}>
            {headline}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[18px] leading-relaxed text-white/60">
            A comprehensive hub spanning the entire campaign lifecycle—promotion, live interaction, and evergreen distribution.
          </p>
          
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={onCta}
              className="inline-flex items-center justify-center gap-3 rounded-full px-10 py-4 text-[14px] font-bold tracking-widest uppercase font-mono transition-transform hover:-translate-y-1 hover:shadow-2xl"
              style={{ background: m.accent, color: "white" }}
            >
              {m.cta}
              <MoveRight style={{ width: 18, height: 18 }} />
            </button>
            <button
              className="inline-flex items-center justify-center gap-3 rounded-full border px-10 py-4 text-[14px] font-bold tracking-widest uppercase font-mono text-white transition-colors hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              <Calendar style={{ width: 18, height: 18 }} /> Advisory Session
            </button>
          </div>
        </div>
      </div>
      
      <div className="mx-auto mt-24 flex max-w-5xl flex-col items-center justify-between gap-6 border-t pt-8 text-center md:flex-row md:text-left" style={{ borderColor: "var(--border-soft)" }}>
        <span className="font-serif text-2xl font-medium" style={{ color: "var(--text-ink)" }}>{webinarConfig.brand}</span>
        <div className="flex items-center gap-8">
          <span className="text-[13px] font-mono tracking-wide uppercase" style={{ color: "var(--text-dim)" }}>© 2026 {webinarConfig.brand}.</span>
          <span className="text-[13px] font-mono tracking-wide uppercase opacity-60" style={{ color: "var(--text-dim)" }}>Engineered via LP Studio</span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Top nav                                                             */
/* ------------------------------------------------------------------ */

function Nav({ status, onCta }: { status: EventStatus; onCta: () => void }) {
  const m = STATUS_META[status];
  return (
    <nav
      className="sticky top-0 z-40 transition-all duration-300"
      style={{ background: "rgba(253, 252, 249, 0.9)", borderBottom: "1px solid var(--border-soft)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:py-5">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: "var(--text-ink)" }}>
            <PlayCircle style={{ width: 20, height: 20, color: "white" }} />
          </span>
          <span className="font-serif text-xl font-medium tracking-tight" style={{ color: "var(--text-ink)" }}>{webinarConfig.brand}</span>
        </div>
        
        <div className="hidden items-center gap-10 lg:flex">
          {webinarConfig.nav.map((n) => (
            <a key={n} href={`#${n.toLowerCase()}`} className="text-[13px] font-mono tracking-widest uppercase font-semibold transition-colors hover:text-black" style={{ color: "var(--text-dim)" }}>
              {n}
            </a>
          ))}
        </div>
        
        <button
          onClick={onCta}
          className="hidden md:inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-bold tracking-widest uppercase font-mono transition-colors hover:opacity-90"
          style={{ background: "var(--text-ink)", color: "white" }}
        >
          {m.cta}
        </button>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function WebinarHub() {
  const [status, setStatus] = useState<EventStatus>(webinarConfig.status);
  const [params, setParams] = useState<{ topic?: string; speaker?: string; resource?: string }>({});

  // UTM / personalization via URLSearchParams
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const topic = sp.get("topic") || undefined;
    const speaker = sp.get("speaker") || undefined;
    const resource = sp.get("resource") || undefined;
    if (sp.get("replay") === "true") setStatus("on-demand");
    setParams({ topic, speaker, resource });
  }, []);

  const m = STATUS_META[status];
  const topicVariant = params.topic ? (webinarConfig.topics as Record<string, { sub: string; resource: string }>)[params.topic] : undefined;
  const subheadline = topicVariant?.sub ?? webinarConfig.subtitle;
  const featuredResource = topicVariant?.resource;
  const slidesFirst = params.resource === "slides";

  const scrollToRegister = () => {
    document.getElementById("register")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="webinar-hub-wrapper antialiased selection:bg-black selection:text-white" style={{ background: "var(--bg-base)", color: "var(--text-ink)" }}>
      <Nav status={status} onCta={scrollToRegister} />

      {/* HERO */}
      <header id="overview" className="relative overflow-hidden px-6 pb-24 pt-20 lg:pt-32 lg:pb-32 wh-hero-gradient border-b" style={{ borderColor: "var(--border-soft)" }}>
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-12">
          
          <div className="lg:col-span-6 z-10 relative">
            <div className="wh-animate-fade-up">
              <StatusPill status={status} />
            </div>
            
            <p className="mt-8 font-mono uppercase tracking-[0.2em] font-semibold text-[12px] wh-animate-fade-up wh-delay-1" style={{ color: m.accent }}>
              {m.kicker}
            </p>
            
            <h1
              className="mt-4 font-serif text-[clamp(44px,6vw,76px)] font-medium leading-[1.05] wh-animate-fade-up wh-delay-2"
              style={{ color: "var(--text-ink)" }}
            >
              {webinarConfig.title}.
            </h1>
            
            <p className="mt-8 max-w-lg text-[18px] leading-relaxed wh-animate-fade-up wh-delay-3" style={{ color: "var(--text-dim)" }}>
              {subheadline}
            </p>

            {/* meta row */}
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 pt-8 border-t wh-animate-fade-up wh-delay-4" style={{ borderColor: "var(--border-soft)", color: "var(--text-ink)" }}>
              <span className="flex items-center gap-2.5 text-[15px] font-medium">
                <Calendar className="w-5 h-5 opacity-40" /> {webinarConfig.date}
              </span>
              <span className="flex items-center gap-2.5 text-[15px] font-medium">
                <Clock className="w-5 h-5 opacity-40" /> {webinarConfig.time} {webinarConfig.timezone}
              </span>
            </div>

            <div className="mt-12 flex flex-col gap-4 sm:flex-row wh-animate-fade-up wh-delay-4">
              <button
                onClick={scrollToRegister}
                className="inline-flex items-center justify-center gap-3 rounded-full px-8 py-4 text-[13px] font-bold tracking-widest uppercase font-mono transition-transform hover:-translate-y-1 shadow-xl shadow-black/5"
                style={{ background: "var(--text-ink)", color: "white" }}
              >
                {m.cta}
                <MoveRight style={{ width: 16, height: 16 }} />
              </button>
              <a
                href="#agenda"
                className="inline-flex items-center justify-center gap-3 rounded-full border px-8 py-4 text-[13px] font-bold tracking-widest uppercase font-mono transition-colors hover:bg-black/5"
                style={{ borderColor: "var(--border-soft)", color: "var(--text-ink)" }}
              >
                View Itinerary
              </a>
            </div>
          </div>

          <div className="lg:col-span-6 z-10 wh-animate-fade-up wh-delay-3">
            <HeroVideoCard status={status} />
          </div>
        </div>
      </header>

      {/* REGISTRATION + STATUS PANEL */}
      <section id="register" className="px-6 py-32 relative" style={{ background: "var(--bg-base)" }}>
        <div className="mx-auto grid max-w-6xl items-start gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5 lg:sticky lg:top-32">
            <Eyebrow>{m.eyebrow}</Eyebrow>
            <h2 className="mt-4 font-serif text-[clamp(36px,4vw,48px)] font-medium leading-[1.1]" style={{ color: "var(--text-ink)" }}>
              {m.kicker}.
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
              {status === "on-demand"
                ? "Provide your details to securely access the comprehensive archive, presentation deck, and supplemental materials."
                : status === "live"
                ? "Broadcast currently underway. Enter the live environment to observe and participate in the Q&A."
                : "Register to receive the calendar invitation, automated reminders, and eventual access to the session archive."}
            </p>
            <div className="mt-12">
              <StatusPanel status={status} />
            </div>
          </div>
          <div className="lg:col-span-7">
            <RegistrationForm status={status} />
          </div>
        </div>
      </section>

      <WorkflowSection />
      <AgendaSection />
      <SpeakersSection highlight={params.speaker} />
      <VideoModule status={status} slidesFirst={slidesFirst} />
      <ResourcesSection featured={featuredResource} />
      <FaqSection />
      <FinalCta status={status} onCta={scrollToRegister} />

      <FloatingToggle status={status} setStatus={setStatus} />
    </div>
  );
}

export default WebinarHub;