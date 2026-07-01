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
    bio: "Elena started the company after a decade leading revenue teams, frustrated that great campaigns kept dying in messy handoffs between marketing, sales, and design. She sets product direction and still spends most of her week with customers, turning their hardest workflows into the features the whole team builds around.",
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

const HEADLINE = "The people behind the work";
const SUBHEADLINE =
  "A small, senior team that has shipped for brands you know. Choose a name to read more about who does what — and how they think.";

/* In the real block, `showHeader` is a toggle. It defaults on when there's a
   team to introduce, and is most useful once there is more than one person. */
export function AboutTeam({
  showHeader = TEAM.length > 1,
}: { showHeader?: boolean } = {}) {
  const [activeId, setActiveId] = useState(TEAM[0].id);
  const active = TEAM.find((m) => m.id === activeId) ?? TEAM[0];
  const hasTeam = TEAM.length > 1;

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
      <section className="relative mx-auto max-w-5xl px-8 py-16 md:px-12 md:py-20">
        {/* Optional header — best when introducing more than one person */}
        {showHeader && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "var(--about-brand)" }}
            >
              Our team
            </p>
            <h2 className="about-serif mt-4 text-4xl font-semibold leading-[1.08] md:text-5xl">
              {HEADLINE}
            </h2>
            <p
              className="mt-5 text-base leading-relaxed md:text-lg"
              style={{ color: "var(--about-muted)" }}
            >
              {SUBHEADLINE}
            </p>
          </div>
        )}

        {/* Active member — founder-style layout */}
        <div
          key={active.id}
          className="about-fade grid gap-10 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-14"
        >
          <div className="relative">
            <img
              src={active.photo}
              alt={active.name}
              className="aspect-[3/4] w-full rounded-[24px] object-cover"
              style={{ boxShadow: "0 40px 80px -50px rgba(20,19,34,0.6)" }}
            />
            <span
              aria-hidden
              className="absolute -bottom-4 -left-4 h-24 w-24 rounded-[24px]"
              style={{
                background: "var(--about-brand-soft)",
                outline: "8px solid var(--about-paper)",
                zIndex: -1,
              }}
            />
          </div>

          <div className="flex flex-col">
            <h3 className="about-serif text-4xl font-semibold leading-[1.08] md:text-5xl">
              {active.name}
            </h3>
            <p
              className="mt-2 text-lg font-medium"
              style={{ color: "var(--about-brand)" }}
            >
              {active.role}
            </p>

            <div
              className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
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

            <p className="mt-6 text-[15px] leading-[1.8]">{active.bio}</p>

            <div
              className="mt-8 flex items-center gap-2"
              style={{ color: "var(--about-muted)" }}
            >
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                aria-label={`${active.name} on LinkedIn`}
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ outline: "1px solid var(--about-line)" }}
              >
                <Linkedin className="h-4 w-4" strokeWidth={1.75} />
              </a>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                aria-label={`Email ${active.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ outline: "1px solid var(--about-line)" }}
              >
                <Mail className="h-4 w-4" strokeWidth={1.75} />
              </a>
            </div>
          </div>
        </div>

        {/* Team roster — a row of people to choose from */}
        {hasTeam && (
          <div
            className="mt-14 border-t pt-10"
            style={{ borderColor: "var(--about-line)" }}
          >
            <div
              className="flex flex-wrap justify-center gap-x-8 gap-y-6"
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
                    className="group flex w-[120px] flex-col items-center gap-3 text-center transition-transform duration-200"
                  >
                    <img
                      src={m.photo}
                      alt={m.name}
                      className="h-[72px] w-[72px] rounded-full object-cover transition-all duration-200 group-hover:-translate-y-0.5"
                      style={{
                        boxShadow: selected
                          ? "0 0 0 2px var(--about-paper), 0 0 0 4px var(--about-brand)"
                          : "0 0 0 2px var(--about-paper), 0 0 0 3px var(--about-line)",
                      }}
                    />
                    <span className="leading-tight">
                      <span
                        className="block text-sm font-medium"
                        style={{
                          color: selected
                            ? "var(--about-brand)"
                            : "var(--about-ink)",
                        }}
                      >
                        {m.name}
                      </span>
                      <span
                        className="mt-0.5 block text-xs"
                        style={{ color: "var(--about-muted)" }}
                      >
                        {m.role}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
