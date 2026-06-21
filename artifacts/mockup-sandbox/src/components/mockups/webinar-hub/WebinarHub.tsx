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
} from "lucide-react";

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
      tint: "#4F46E5",
    },
    {
      id: "dev-okafor",
      name: "Dev Okafor",
      role: "Head of Demand, Lumen",
      bio: "Runs always-on webinar programs across three regions. Former RevOps lead.",
      initials: "DO",
      tint: "#0EA5A4",
    },
    {
      id: "sara-lind",
      name: "Sara Lind",
      role: "Founder, Studio Method",
      bio: "Advises B2B teams on turning live events into evergreen demand surfaces.",
      initials: "SL",
      tint: "#D97706",
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
    eyebrow: "Upcoming Webinar",
    kicker: "Save your seat",
    cta: "Register Now",
    formCta: "Register for Webinar",
    formSuccess: "You're registered. Check your email for the calendar invite and reminders.",
    videoLabel: "Teaser preview",
    accent: "#D97706",
    soft: "#FEF3E2",
    pulse: false,
  },
  live: {
    eyebrow: "Live Now",
    kicker: "We're live now",
    cta: "Join Live",
    formCta: "Join Session",
    formSuccess: "You're in. Launching the live session.",
    videoLabel: "Live stream",
    accent: "#E11D48",
    soft: "#FEE8EC",
    pulse: true,
  },
  "on-demand": {
    eyebrow: "On Demand",
    kicker: "Watch the replay",
    cta: "Watch Replay",
    formCta: "Watch Replay",
    formSuccess: "Here's your replay. Enjoy — the slides and resources are below.",
    videoLabel: "Replay",
    accent: "#4F46E5",
    soft: "#EEF0FF",
    pulse: false,
  },
};

const INK = "#0D1017";
const INK_2 = "#161B25";
const CREAM = "#FAF8F4";

/* ------------------------------------------------------------------ */
/* Small shared atoms                                                  */
/* ------------------------------------------------------------------ */

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className="font-['DM_Mono'] uppercase"
      style={{
        fontSize: 11.5,
        letterSpacing: "0.22em",
        color: dark ? "rgba(255,255,255,0.55)" : "#8A8577",
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
      className="inline-flex items-center gap-2 rounded-full"
      style={{
        padding: "7px 14px",
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: m.accent,
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${m.accent}55`,
        backdropFilter: "blur(4px)",
      }}
    >
      <span className="relative flex" style={{ width: 8, height: 8 }}>
        {m.pulse && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
            style={{ background: m.accent }}
          />
        )}
        <span className="relative inline-flex rounded-full" style={{ width: 8, height: 8, background: m.accent }} />
      </span>
      {m.eyebrow}
    </span>
  );
}

function Avatar({ initials, tint, size = 40, ring }: { initials: string; tint: string; size?: number; ring?: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(145deg, ${tint}, ${tint}bb)`,
        boxShadow: ring ? `0 0 0 3px ${CREAM}, 0 0 0 5px ${tint}` : `0 0 0 3px ${CREAM}`,
      }}
    >
      {initials}
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
      className="fixed z-50 flex items-center gap-1 rounded-full"
      style={{
        bottom: 22,
        left: "50%",
        transform: "translateX(-50%)",
        padding: 5,
        background: "rgba(13,16,23,0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span className="px-2 text-white/40" style={{ fontSize: 10.5, letterSpacing: "0.1em" }} aria-hidden>
        DEMO
      </span>
      {opts.map((o) => {
        const active = o === status;
        return (
          <button
            key={o}
            onClick={() => setStatus(o)}
            className="rounded-full transition-all"
            style={{
              padding: "7px 15px",
              fontSize: 13,
              fontWeight: 600,
              color: active ? INK : "rgba(255,255,255,0.7)",
              background: active ? STATUS_META[o].accent : "transparent",
            }}
          >
            {label[o]}
          </button>
        );
      })}
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
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 40px 80px -40px rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
      }}
    >
      {/* video surface */}
      <div
        className="relative"
        style={{
          aspectRatio: "16 / 10",
          background: `radial-gradient(120% 120% at 20% 0%, ${m.accent}33, transparent 55%), linear-gradient(150deg, #1c2230, #0c0f16)`,
        }}
      >
        {/* status chip */}
        <div className="absolute left-4 top-4">
          <StatusPill status={status} />
        </div>

        {/* duration / time chip */}
        <div
          className="absolute right-4 top-4 rounded-full font-['DM_Mono']"
          style={{ padding: "5px 11px", fontSize: 12, color: "white", background: "rgba(0,0,0,0.4)" }}
        >
          58:24
        </div>

        {/* play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center justify-center rounded-full transition-transform"
            style={{
              width: 78,
              height: 78,
              background: "rgba(255,255,255,0.95)",
              boxShadow: `0 0 0 12px ${m.accent}22, 0 20px 40px -10px rgba(0,0,0,0.5)`,
            }}
          >
            <Play style={{ width: 28, height: 28, color: INK, marginLeft: 3 }} fill={INK} />
          </div>
        </div>

        {/* faux waveform / progress for on-demand */}
        {status === "on-demand" && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="h-1 w-full rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
              <div className="h-1 rounded-full" style={{ width: "38%", background: m.accent }} />
            </div>
          </div>
        )}
      </div>

      {/* meta footer */}
      <div className="p-5" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="text-white font-semibold" style={{ fontSize: 15 }}>
          {webinarConfig.title}
        </div>
        <div className="mt-1 text-white/45" style={{ fontSize: 13 }}>
          {webinarConfig.date} · {webinarConfig.time} {webinarConfig.timezone}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center" style={{ marginLeft: 4 }}>
            {webinarConfig.speakers.map((s, i) => (
              <div key={s.id} style={{ marginLeft: i === 0 ? 0 : -12 }}>
                <Avatar initials={s.initials} tint={s.tint} size={34} />
              </div>
            ))}
            <span className="ml-3 text-white/55" style={{ fontSize: 12.5 }}>
              {webinarConfig.speakers.length} speakers
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-white/55" style={{ fontSize: 12.5 }}>
            <Users style={{ width: 14, height: 14 }} />
            {webinarConfig.registrations.toLocaleString()}+
          </span>
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
    "w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-[#0D1017] placeholder:text-[#aaa39a] outline-none transition focus:border-[#0D1017]";

  if (done) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{ background: "white", borderColor: "#ECE7DD", boxShadow: "0 24px 60px -40px rgba(0,0,0,0.25)" }}
      >
        <div
          className="mx-auto mb-5 flex items-center justify-center rounded-full"
          style={{ width: 56, height: 56, background: m.soft }}
        >
          <Check style={{ width: 26, height: 26, color: m.accent }} strokeWidth={2.5} />
        </div>
        <h3 className="font-['Source_Serif_4'] text-[#0D1017]" style={{ fontSize: 24, fontWeight: 600 }}>
          {status === "live" ? "You're in" : status === "on-demand" ? "Replay unlocked" : "You're registered"}
        </h3>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#5b5749]">{m.formSuccess}</p>
        <button
          onClick={() => setDone(false)}
          className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold"
          style={{ background: INK, color: "white" }}
        >
          {status === "on-demand" ? "Play replay" : "Add to calendar"}
          <ArrowRight style={{ width: 16, height: 16 }} />
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
      className="rounded-2xl border p-6 sm:p-8"
      style={{ background: "white", borderColor: "#ECE7DD", boxShadow: "0 24px 60px -40px rgba(0,0,0,0.25)" }}
    >
      <div className="mb-5">
        <Eyebrow>{status === "on-demand" ? "Replay access" : "Reserve your spot"}</Eyebrow>
        <h3 className="mt-2 font-['Source_Serif_4'] text-[#0D1017]" style={{ fontSize: 26, fontWeight: 600 }}>
          {status === "on-demand" ? "Get instant access to the replay" : "Save your seat"}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input className={field} style={{ borderColor: "#ECE7DD" }} placeholder="First name" required />
        <input className={field} style={{ borderColor: "#ECE7DD" }} placeholder="Last name" required />
        <input className={field} style={{ borderColor: "#ECE7DD" }} type="email" placeholder="Work email" required />
        <input className={field} style={{ borderColor: "#ECE7DD" }} placeholder="Company" required />
        <input className={field} style={{ borderColor: "#ECE7DD" }} placeholder="Job title" />
        <input className={field} style={{ borderColor: "#ECE7DD" }} placeholder="Company website" />
      </div>
      <textarea
        className={field + " mt-3 resize-none"}
        style={{ borderColor: "#ECE7DD" }}
        rows={2}
        placeholder="What are you hoping to learn? (optional)"
      />
      <button
        type="submit"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white transition hover:opacity-95"
        style={{ background: INK }}
      >
        {m.formCta}
        <ArrowRight style={{ width: 17, height: 17 }} />
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-[#9a9486]">
        <ShieldCheck style={{ width: 13, height: 13 }} />
        No spam. Replay and slides sent to everyone who registers.
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
      <div className="space-y-4">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ aspectRatio: "16/9", background: "linear-gradient(150deg,#1c2230,#0c0f16)" }}
        >
          <div className="absolute left-4 top-4">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold text-white"
              style={{ background: m.accent }}
            >
              <Radio style={{ width: 13, height: 13 }} /> LIVE
            </span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Video style={{ width: 40, height: 40, color: "rgba(255,255,255,0.4)" }} />
          </div>
        </div>
        <div className="rounded-2xl border p-5" style={{ borderColor: "#ECE7DD", background: "white" }}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#0D1017]" style={{ fontSize: 14.5 }}>
              Live Q&amp;A
            </span>
            <span className="text-[12px] text-[#9a9486]">312 watching</span>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ["AR", "Where do you host the live stream?"],
              ["TM", "Will this work for a 6-person team?"],
            ].map(([i, q]) => (
              <div key={q} className="flex items-start gap-3">
                <Avatar initials={i} tint="#94908a" size={30} />
                <p className="text-[13.5px] leading-snug text-[#5b5749]">{q}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-xl border px-3 py-2.5 text-[14px] outline-none"
              style={{ borderColor: "#ECE7DD" }}
              placeholder="Submit a question…"
            />
            <button className="rounded-xl px-3 text-white" style={{ background: INK }}>
              <Send style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-[14px] font-semibold text-[#0D1017]"
          style={{ borderColor: "#ECE7DD", background: "white" }}
        >
          <CalendarPlus style={{ width: 16, height: 16 }} /> Add to calendar
        </button>
      </div>
    );
  }

  if (status === "on-demand") {
    return (
      <div className="space-y-4">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ aspectRatio: "16/9", background: "linear-gradient(150deg,#1c2230,#0c0f16)" }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 60, height: 60, background: "rgba(255,255,255,0.95)" }}
            >
              <Play style={{ width: 22, height: 22, color: INK, marginLeft: 2 }} fill={INK} />
            </div>
          </div>
          <div className="absolute bottom-3 left-4 right-4">
            <div className="h-1 w-full rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
              <div className="h-1 rounded-full" style={{ width: "38%", background: m.accent }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            className="flex items-center justify-center gap-2 rounded-xl border py-3 text-[14px] font-semibold text-[#0D1017]"
            style={{ borderColor: "#ECE7DD", background: "white" }}
          >
            <Download style={{ width: 16, height: 16 }} /> Get the slides
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white"
            style={{ background: INK }}
          >
            <Calendar style={{ width: 16, height: 16 }} /> Book a follow-up
          </button>
        </div>
        <div className="rounded-2xl border p-5" style={{ borderColor: "#ECE7DD", background: "white" }}>
          <Eyebrow>In this replay</Eyebrow>
          <ul className="mt-3 space-y-2.5">
            {["The hub model, end to end", "Northwind's 40% pipeline story", "Live Q&A highlights"].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[14px] text-[#5b5749]">
                <Check style={{ width: 16, height: 16, color: m.accent, marginTop: 2 }} strokeWidth={2.5} />
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
    <div className="space-y-4">
      <div className="rounded-2xl border p-6" style={{ borderColor: "#ECE7DD", background: "white" }}>
        <Eyebrow>What you'll learn</Eyebrow>
        <ul className="mt-4 space-y-3.5">
          {[
            "The hub model that keeps webinars working after the live date",
            "How to wire registration, reminders, and replay into one flow",
            "A teardown of a hub that sourced 40% of pipeline",
          ].map((t) => (
            <li key={t} className="flex items-start gap-3 text-[15px] leading-snug text-[#3c3930]">
              <span
                className="mt-0.5 flex items-center justify-center rounded-full"
                style={{ width: 22, height: 22, background: m.soft, flexShrink: 0 }}
              >
                <Check style={{ width: 14, height: 14, color: m.accent }} strokeWidth={2.5} />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div
        className="flex items-start gap-3 rounded-2xl p-5"
        style={{ background: m.soft, border: `1px solid ${m.accent}33` }}
      >
        <Bell style={{ width: 18, height: 18, color: m.accent, marginTop: 2 }} />
        <p className="text-[13.5px] leading-snug" style={{ color: "#5b4a2a" }}>
          Register once and we'll send a calendar hold plus reminders 24 hours and 1 hour before we go live.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workflow feature section                                            */
/* ------------------------------------------------------------------ */

const WORKFLOW_FEATURES: { icon: React.ReactNode; label: string }[] = [
  { icon: <FileText />, label: "Registration page" },
  { icon: <CalendarPlus />, label: "Calendar hold" },
  { icon: <Bell />, label: "Reminder emails" },
  { icon: <Video />, label: "Live video embed" },
  { icon: <MessageSquare />, label: "Q&A collection" },
  { icon: <PlayCircle />, label: "On-demand replay" },
  { icon: <Layers />, label: "Resource follow-up" },
  { icon: <Globe />, label: "UTM personalization" },
];

const EMAIL_ICONS: Record<string, React.ReactNode> = {
  confirm: <Mail style={{ width: 16, height: 16 }} />,
  bell: <Bell style={{ width: 16, height: 16 }} />,
  clock: <Clock style={{ width: 16, height: 16 }} />,
  replay: <PlayCircle style={{ width: 16, height: 16 }} />,
};

function WorkflowSection() {
  return (
    <section className="px-6 py-24" style={{ background: "white" }}>
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Eyebrow>The system</Eyebrow>
          <h2
            className="mt-3 font-['Source_Serif_4'] text-[#0D1017]"
            style={{ fontSize: "clamp(30px,3.4vw,44px)", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.08 }}
          >
            Built for the full webinar workflow.
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-[#5b5749]">
            This isn't a registration page — it's a campaign system. One hub runs promotion, the live event,
            the replay, and every follow-up.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {WORKFLOW_FEATURES.map((f) => (
            <div
              key={f.label}
              className="rounded-2xl border p-5 transition hover:-translate-y-0.5"
              style={{ borderColor: "#ECE7DD", background: CREAM }}
            >
              <span className="flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: "white", border: "1px solid #ECE7DD" }}>
                <span style={{ color: "#4F46E5", display: "inline-flex" }}>
                  {/* size lucide via wrapper */}
                  <span className="[&>svg]:h-[19px] [&>svg]:w-[19px]">{f.icon}</span>
                </span>
              </span>
              <div className="mt-4 text-[14.5px] font-semibold text-[#0D1017]">{f.label}</div>
            </div>
          ))}
        </div>

        {/* email sequence */}
        <div className="mt-8 rounded-3xl border p-7 sm:p-9" style={{ borderColor: "#ECE7DD", background: CREAM }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Eyebrow>Automated email sequence</Eyebrow>
              <h3 className="mt-2 font-['Source_Serif_4'] text-[#0D1017]" style={{ fontSize: 22, fontWeight: 600 }}>
                Reminders and follow-ups, on autopilot
              </h3>
            </div>
            <span
              className="inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-2 font-['DM_Mono'] text-[12.5px] text-[#5b5749]"
              style={{ borderColor: "#ECE7DD" }}
            >
              <Globe style={{ width: 14, height: 14 }} /> {webinarConfig.emails.sender}
            </span>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {webinarConfig.emails.sequence.map((e, i) => (
              <div key={e.label} className="relative rounded-2xl border bg-white p-5" style={{ borderColor: "#ECE7DD" }}>
                <span className="font-['DM_Mono'] text-[11px] uppercase tracking-wider text-[#9a9486]">
                  Step {i + 1} · {e.when}
                </span>
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="flex items-center justify-center rounded-lg" style={{ width: 34, height: 34, background: "#EEF0FF", color: "#4F46E5" }}>
                    {EMAIL_ICONS[e.icon]}
                  </span>
                  <span className="text-[14.5px] font-semibold text-[#0D1017]">{e.label}</span>
                </div>
                <p className="mt-3 text-[13px] leading-snug text-[#5b5749]">{e.desc}</p>
              </div>
            ))}
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
    <section id="agenda" className="px-6 py-24" style={{ background: CREAM }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 max-w-2xl">
          <Eyebrow>Agenda</Eyebrow>
          <h2 className="mt-3 font-['Source_Serif_4'] text-[#0D1017]" style={{ fontSize: "clamp(30px,3.4vw,44px)", fontWeight: 600, letterSpacing: "-0.01em" }}>
            One hour, tightly run.
          </h2>
        </div>
        <div className="relative space-y-3">
          {webinarConfig.agenda.map((a, i) => (
            <div
              key={a.title}
              className="group flex flex-col gap-4 rounded-2xl border bg-white p-6 sm:flex-row sm:items-center"
              style={{ borderColor: "#ECE7DD" }}
            >
              <div className="flex items-center gap-4 sm:w-40 sm:shrink-0">
                <span className="font-['DM_Mono'] text-[#9a9486]" style={{ fontSize: 13 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-['DM_Mono'] font-semibold text-[#0D1017]" style={{ fontSize: 16 }}>
                  {a.time}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-[17px] font-semibold text-[#0D1017]">{a.title}</h3>
                <p className="mt-1 text-[14px] leading-snug text-[#5b5749]">{a.desc}</p>
              </div>
              <span className="text-[13px] text-[#9a9486] sm:text-right">{a.speaker}</span>
            </div>
          ))}
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
    <section id="speakers" className="px-6 py-24" style={{ background: "white" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <Eyebrow>Speakers</Eyebrow>
          <h2 className="mt-3 font-['Source_Serif_4'] text-[#0D1017]" style={{ fontSize: "clamp(30px,3.4vw,44px)", fontWeight: 600, letterSpacing: "-0.01em" }}>
            The people running the session.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {webinarConfig.speakers.map((s) => {
            const on = highlight === s.id;
            return (
              <div
                key={s.id}
                className="rounded-2xl border p-7 transition"
                style={{
                  borderColor: on ? `${s.tint}` : "#ECE7DD",
                  background: on ? `${s.tint}0c` : CREAM,
                  boxShadow: on ? `0 0 0 1px ${s.tint}` : "none",
                }}
              >
                <Avatar initials={s.initials} tint={s.tint} size={64} />
                {on && (
                  <span className="mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: s.tint, color: "white" }}>
                    Featured speaker
                  </span>
                )}
                <h3 className="mt-4 text-[18px] font-semibold text-[#0D1017]">{s.name}</h3>
                <p className="mt-0.5 text-[13.5px] font-medium" style={{ color: s.tint }}>
                  {s.role}
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-[#5b5749]">{s.bio}</p>
                <button className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5b5749] hover:text-[#0D1017]">
                  <Linkedin style={{ width: 15, height: 15 }} /> LinkedIn
                </button>
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
  { id: "replay", label: "Full replay", icon: <PlayCircle style={{ width: 15, height: 15 }} /> },
  { id: "highlight", label: "3-min highlight", icon: <Sparkles style={{ width: 15, height: 15 }} /> },
  { id: "slides", label: "Slides", icon: <FileText style={{ width: 15, height: 15 }} /> },
  { id: "transcript", label: "Transcript", icon: <Quote style={{ width: 15, height: 15 }} /> },
  { id: "resources", label: "Related", icon: <Layers style={{ width: 15, height: 15 }} /> },
];

function VideoModule({ status, slidesFirst }: { status: EventStatus; slidesFirst?: boolean }) {
  const m = STATUS_META[status];
  const [tab, setTab] = useState(slidesFirst ? "slides" : "replay");
  useEffect(() => {
    setTab(slidesFirst ? "slides" : "replay");
  }, [slidesFirst]);

  return (
    <section className="px-6 py-24" style={{ background: INK }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <Eyebrow dark>Featured {m.videoLabel.toLowerCase()}</Eyebrow>
            <h2 className="mt-3 font-['Source_Serif_4'] text-white" style={{ fontSize: "clamp(30px,3.4vw,44px)", fontWeight: 600, letterSpacing: "-0.01em" }}>
              {status === "live" ? "We're live right now." : status === "on-demand" ? "Watch the full replay." : "A preview of what's coming."}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {VIDEO_TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition"
                  style={{
                    background: active ? m.accent : "rgba(255,255,255,0.06)",
                    color: active ? INK : "rgba(255,255,255,0.7)",
                    border: active ? "none" : "1px solid rgba(255,255,255,0.12)",
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
          className="relative overflow-hidden rounded-3xl"
          style={{ aspectRatio: "16/8", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(110% 110% at 30% 0%, ${m.accent}33, transparent 55%), linear-gradient(150deg,#1c2230,#0c0f16)` }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {status === "live" && (
              <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold text-white" style={{ background: m.accent }}>
                <Radio style={{ width: 14, height: 14 }} /> LIVE NOW
              </span>
            )}
            <div className="flex items-center justify-center rounded-full" style={{ width: 84, height: 84, background: "rgba(255,255,255,0.95)", boxShadow: `0 0 0 14px ${m.accent}22` }}>
              {tab === "slides" ? (
                <FileText style={{ width: 30, height: 30, color: INK }} />
              ) : tab === "transcript" ? (
                <Quote style={{ width: 30, height: 30, color: INK }} />
              ) : (
                <Play style={{ width: 30, height: 30, color: INK, marginLeft: 3 }} fill={INK} />
              )}
            </div>
            <p className="text-[14px] text-white/55">
              {VIDEO_TABS.find((t) => t.id === tab)?.label}
              {tab === "replay" && " · 58:24"}
              {tab === "highlight" && " · 03:12"}
            </p>
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
  deck: <FileText style={{ width: 18, height: 18 }} />,
  guide: <BookOpen style={{ width: 18, height: 18 }} />,
  checklist: <ClipboardCheck style={{ width: 18, height: 18 }} />,
  case: <Layers style={{ width: 18, height: 18 }} />,
  article: <Newspaper style={{ width: 18, height: 18 }} />,
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
    <section id="resources" className="px-6 py-24" style={{ background: CREAM }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <Eyebrow>Resources</Eyebrow>
          <h2 className="mt-3 font-['Source_Serif_4'] text-[#0D1017]" style={{ fontSize: "clamp(30px,3.4vw,44px)", fontWeight: 600, letterSpacing: "-0.01em" }}>
            Keep going after the session.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r, i) => {
            const isFeatured = featured && r.title === featured && i === 0;
            return (
              <div
                key={r.title}
                className="group flex flex-col rounded-2xl border bg-white p-6 transition hover:-translate-y-0.5"
                style={{ borderColor: isFeatured ? "#4F46E5" : "#ECE7DD", boxShadow: isFeatured ? "0 0 0 1px #4F46E5" : "none" }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: "#EEF0FF", color: "#4F46E5" }}>
                    {RES_ICON[r.icon]}
                  </span>
                  <span className="font-['DM_Mono'] text-[11px] uppercase tracking-wider text-[#9a9486]">{r.format}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-[#0D1017]">{r.title}</h3>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[#5b5749]">{r.desc}</p>
                <button className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#4F46E5]">
                  Get it <ArrowRight style={{ width: 15, height: 15 }} />
                </button>
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
    <section id="faq" className="px-6 py-24" style={{ background: "white" }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 font-['Source_Serif_4'] text-[#0D1017]" style={{ fontSize: "clamp(30px,3.4vw,44px)", fontWeight: 600, letterSpacing: "-0.01em" }}>
            Questions, answered.
          </h2>
        </div>
        <div className="divide-y" style={{ borderColor: "#ECE7DD" }}>
          {webinarConfig.faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} style={{ borderColor: "#ECE7DD" }} className="border-t last:border-b">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-[16.5px] font-semibold text-[#0D1017]">{f.q}</span>
                  <ChevronDown
                    style={{ width: 19, height: 19, color: "#9a9486", transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "none", flexShrink: 0 }}
                  />
                </button>
                {isOpen && <p className="pb-5 pr-8 text-[15px] leading-relaxed text-[#5b5749]">{f.a}</p>}
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
    status === "live" ? "Join the session" : status === "on-demand" ? "Watch the replay" : "Save your seat";
  return (
    <section className="px-6 py-24" style={{ background: INK }}>
      <div
        className="mx-auto max-w-5xl overflow-hidden rounded-3xl p-10 text-center sm:p-16"
        style={{
          background: `radial-gradient(120% 120% at 50% 0%, ${m.accent}2e, transparent 60%), ${INK_2}`,
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex justify-center">
          <StatusPill status={status} />
        </div>
        <h2 className="mx-auto mt-6 max-w-2xl font-['Source_Serif_4'] text-white" style={{ fontSize: "clamp(34px,4.6vw,60px)", fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.02em" }}>
          {headline}.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[16.5px] leading-relaxed text-white/55">
          One hub for the whole lifecycle — promotion, live, replay, and follow-up.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={onCta}
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold transition hover:opacity-95"
            style={{ background: m.accent, color: INK }}
          >
            {m.cta}
            <ArrowRight style={{ width: 17, height: 17 }} />
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full border px-7 py-3.5 text-[15px] font-semibold text-white"
            style={{ borderColor: "rgba(255,255,255,0.2)" }}
          >
            <Calendar style={{ width: 16, height: 16 }} /> Book a follow-up
          </button>
        </div>
      </div>
      <div className="mx-auto mt-16 flex max-w-5xl flex-col items-center justify-between gap-4 border-t pt-8 text-white/40 sm:flex-row" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <span className="font-['Source_Serif_4'] text-[17px] font-semibold text-white/70">{webinarConfig.brand}</span>
        <span className="text-[13px]">© 2026 {webinarConfig.brand}. A webinar hub built in LP Studio.</span>
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
      className="sticky top-0 z-40"
      style={{ background: "rgba(13,16,23,0.72)", borderBottom: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: m.accent }}>
            <PlayCircle style={{ width: 18, height: 18, color: INK }} />
          </span>
          <span className="font-['Source_Serif_4'] text-[17px] font-semibold text-white">{webinarConfig.brand}</span>
        </div>
        <div className="hidden items-center gap-7 md:flex">
          {webinarConfig.nav.map((n) => (
            <a key={n} href={`#${n.toLowerCase()}`} className="text-[14px] text-white/60 transition hover:text-white">
              {n}
            </a>
          ))}
        </div>
        <button
          onClick={onCta}
          className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold transition hover:opacity-95"
          style={{ background: m.accent, color: INK }}
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
    <div className="font-['Inter'] antialiased" style={{ background: CREAM, color: INK }}>
      <Nav status={status} onCta={scrollToRegister} />

      {/* HERO */}
      <header id="overview" className="relative overflow-hidden px-6 pb-24 pt-20" style={{ background: INK }}>
        {/* glows */}
        <div
          className="pointer-events-none absolute -left-32 -top-32 rounded-full"
          style={{ width: 480, height: 480, background: `radial-gradient(circle, ${m.accent}33, transparent 70%)`, filter: "blur(20px)" }}
        />
        <div
          className="pointer-events-none absolute -right-20 top-40 rounded-full"
          style={{ width: 420, height: 420, background: "radial-gradient(circle, #4F46E522, transparent 70%)", filter: "blur(20px)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <StatusPill status={status} />
            <p className="mt-6 font-['DM_Mono'] uppercase" style={{ fontSize: 12.5, letterSpacing: "0.18em", color: m.accent }}>
              {m.kicker}
            </p>
            <h1
              className="mt-3 font-['Source_Serif_4'] text-white"
              style={{ fontSize: "clamp(38px,5vw,64px)", fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.025em" }}
            >
              {webinarConfig.title}
            </h1>
            <p className="mt-6 max-w-xl text-[17.5px] leading-relaxed text-white/55">{subheadline}</p>

            {/* meta row */}
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-white/70">
              <span className="flex items-center gap-2 text-[14px]">
                <Calendar style={{ width: 16, height: 16, color: m.accent }} /> {webinarConfig.date}
              </span>
              <span className="flex items-center gap-2 text-[14px]">
                <Clock style={{ width: 16, height: 16, color: m.accent }} /> {webinarConfig.time} {webinarConfig.timezone}
              </span>
              <span className="flex items-center gap-2 text-[14px]">
                <Users style={{ width: 16, height: 16, color: m.accent }} /> {webinarConfig.registrations.toLocaleString()}+ registered
              </span>
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={scrollToRegister}
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold transition hover:opacity-95"
                style={{ background: m.accent, color: INK }}
              >
                {m.cta}
                <ArrowRight style={{ width: 17, height: 17 }} />
              </button>
              <a
                href="#agenda"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-[15px] font-semibold text-white"
                style={{ borderColor: "rgba(255,255,255,0.2)" }}
              >
                View Agenda
              </a>
            </div>
          </div>

          <HeroVideoCard status={status} />
        </div>
      </header>

      {/* REGISTRATION + STATUS PANEL */}
      <section id="register" className="px-6 py-24" style={{ background: CREAM }}>
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>{m.eyebrow}</Eyebrow>
            <h2 className="mt-3 font-['Source_Serif_4'] text-[#0D1017]" style={{ fontSize: "clamp(30px,3.4vw,46px)", fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.015em" }}>
              {m.kicker}.
            </h2>
            <p className="mt-4 max-w-md text-[16.5px] leading-relaxed text-[#5b5749]">
              {status === "on-demand"
                ? "Enter your details to unlock the full replay, slides, and follow-up resources."
                : status === "live"
                ? "We've started — join the live room and bring your questions to the Q&A."
                : "Register once and get the calendar invite, reminders, and replay automatically."}
            </p>
            <div className="mt-8">
              <StatusPanel status={status} />
            </div>
          </div>
          <RegistrationForm status={status} />
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
