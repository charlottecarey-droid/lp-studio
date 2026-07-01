import { useState } from "react";
import { MapPin, Linkedin, Mail } from "lucide-react";
import "./_group.css";

type Member = {
  id: string;
  name: string;
  role: string;
  photo: string;
  location: string;
  focus: string;
  bio: string;
};

const TEAM: Member[] = [
  {
    id: "elena",
    name: "Elena Marsh",
    role: "Founder & CEO",
    photo: "/__mockup/images/team-1.png",
    location: "Chicago, IL",
    focus: "Vision & product",
    bio: "Elena started the company after a decade leading revenue teams, frustrated that great campaigns kept dying in messy handoffs. She sets product direction and spends most of her week with customers, turning their hardest workflows into the features the whole team builds around.",
  },
  {
    id: "marcus",
    name: "Marcus Bell",
    role: "Head of Engineering",
    photo: "/__mockup/images/team-2.png",
    location: "Austin, TX",
    focus: "Platform & reliability",
    bio: "Marcus keeps the platform fast and dependable at scale. He came up through infrastructure teams at two high-growth startups and cares about the unglamorous work — clean data, quiet deploys, and pages that load before you even notice they were loading.",
  },
  {
    id: "priya",
    name: "Priya Nair",
    role: "Head of Design",
    photo: "/__mockup/images/team-3.png",
    location: "Toronto, ON",
    focus: "Craft & brand systems",
    bio: "Priya leads design across product and brand. She believes premium isn't decoration — it's clarity, rhythm, and restraint. Every template and interaction ships past her eye, which is why the work feels considered from the first pixel to the last.",
  },
  {
    id: "david",
    name: "David Okafor",
    role: "Head of Customer Success",
    photo: "/__mockup/images/team-4.png",
    location: "London, UK",
    focus: "Onboarding & outcomes",
    bio: "David makes sure teams get value in days, not months. A former agency operator, he has guided hundreds of launches and treats each customer's goals as his own — translating ambitious plans into steady, measurable wins.",
  },
  {
    id: "sofia",
    name: "Sofia Reyes",
    role: "Head of Growth",
    photo: "/__mockup/images/team-5.png",
    location: "Mexico City, MX",
    focus: "Demand & experimentation",
    bio: "Sofia runs growth as a disciplined series of experiments. She pairs sharp storytelling with a bias for data, finding the channels and messages that compound — and quietly cutting the ones that don't, without sentimentality.",
  },
];

export function AboutTeam() {
  const [activeId, setActiveId] = useState(TEAM[0].id);
  const active = TEAM.find((m) => m.id === activeId) ?? TEAM[0];

  return (
    <div
      className="about-sans min-h-screen w-full"
      style={{ background: "var(--about-paper)", color: "var(--about-ink)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "radial-gradient(60% 120% at 15% 0%, var(--about-brand-soft) 0%, transparent 70%)",
        }}
      />
      <section className="relative mx-auto max-w-6xl px-8 py-16 md:px-12 md:py-20">
        {/* Header */}
        <div className="max-w-2xl">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--about-brand)" }}
          >
            Our team
          </p>
          <h2 className="about-serif mt-4 text-4xl font-semibold leading-[1.08] md:text-5xl">
            The people behind the work
          </h2>
          <p
            className="mt-5 text-base leading-relaxed md:text-lg"
            style={{ color: "var(--about-muted)" }}
          >
            A small, senior team that has shipped for brands you know. Choose a
            name to read more about who does what — and how they think.
          </p>
        </div>

        {/* Body: roster + detail */}
        <div className="mt-12 grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-12">
          {/* Roster */}
          <div
            className="about-roster-scroll flex max-h-[560px] flex-col gap-1 overflow-y-auto pr-1"
            role="listbox"
            aria-label="Team members"
          >
            {TEAM.map((m) => {
              const selected = m.id === activeId;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setActiveId(m.id)}
                  className="group relative flex items-center gap-4 rounded-2xl p-3 text-left transition-all duration-200"
                  style={{
                    background: selected ? "var(--about-card)" : "transparent",
                    boxShadow: selected
                      ? "0 12px 30px -18px rgba(20,19,34,0.35)"
                      : "none",
                    outline: selected
                      ? "1px solid var(--about-line)"
                      : "1px solid transparent",
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-8 -translate-y-1/2 rounded-full transition-all duration-200"
                    style={{
                      width: selected ? 3 : 0,
                      background: "var(--about-brand)",
                    }}
                  />
                  <img
                    src={m.photo}
                    alt={m.name}
                    className="h-[52px] w-[52px] flex-none rounded-full object-cover"
                    style={{
                      boxShadow: selected
                        ? "0 0 0 2px var(--about-card), 0 0 0 4px var(--about-brand)"
                        : "0 0 0 2px var(--about-card), 0 0 0 3px var(--about-line)",
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium leading-tight">
                      {m.name}
                    </span>
                    <span
                      className="mt-0.5 block truncate text-sm"
                      style={{ color: "var(--about-muted)" }}
                    >
                      {m.role}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div
            className="rounded-[28px] p-6 sm:p-8"
            style={{
              background: "var(--about-card)",
              boxShadow: "0 40px 80px -50px rgba(20,19,34,0.5)",
              outline: "1px solid var(--about-line)",
            }}
          >
            <div
              key={active.id}
              className="about-fade grid gap-8 sm:grid-cols-[220px_minmax(0,1fr)]"
            >
              <div className="relative">
                <img
                  src={active.photo}
                  alt={active.name}
                  className="aspect-[3/4] w-full rounded-2xl object-cover"
                />
                <span
                  aria-hidden
                  className="absolute -bottom-3 -right-3 h-16 w-16 rounded-2xl"
                  style={{
                    background: "var(--about-brand-soft)",
                    outline: "6px solid var(--about-card)",
                    zIndex: -1,
                  }}
                />
              </div>

              <div className="flex flex-col">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: "var(--about-brand)" }}
                >
                  {active.role}
                </p>
                <h3 className="about-serif mt-2 text-3xl font-semibold leading-tight">
                  {active.name}
                </h3>

                <div
                  className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                  style={{ color: "var(--about-muted)" }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" strokeWidth={1.75} />
                    {active.location}
                  </span>
                  <span
                    aria-hidden
                    className="h-1 w-1 rounded-full"
                    style={{ background: "var(--about-line)" }}
                  />
                  <span>{active.focus}</span>
                </div>

                <p className="mt-5 text-[15px] leading-[1.75]">{active.bio}</p>

                <div
                  className="mt-auto flex items-center gap-2 pt-7"
                  style={{ color: "var(--about-muted)" }}
                >
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    aria-label={`${active.name} on LinkedIn`}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                    style={{ outline: "1px solid var(--about-line)" }}
                  >
                    <Linkedin className="h-4 w-4" strokeWidth={1.75} />
                  </a>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    aria-label={`Email ${active.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                    style={{ outline: "1px solid var(--about-line)" }}
                  >
                    <Mail className="h-4 w-4" strokeWidth={1.75} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
