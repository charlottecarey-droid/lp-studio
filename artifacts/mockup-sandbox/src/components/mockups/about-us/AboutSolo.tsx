import { MapPin, Linkedin, Mail } from "lucide-react";
import "./_group.css";

export function AboutSolo() {
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
            "radial-gradient(60% 120% at 85% 0%, var(--about-brand-soft) 0%, transparent 70%)",
        }}
      />
      <section className="relative mx-auto max-w-5xl px-8 py-16 md:px-12 md:py-20">
        <p
          className="text-center text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: "var(--about-brand)" }}
        >
          About the founder
        </p>

        <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:gap-14">
          {/* Portrait */}
          <div className="relative">
            <img
              src="/__mockup/images/team-1.png"
              alt="Elena Marsh"
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

          {/* Bio */}
          <div className="flex flex-col">
            <h2 className="about-serif text-4xl font-semibold leading-[1.08] md:text-5xl">
              Elena Marsh
            </h2>
            <p
              className="mt-2 text-lg font-medium"
              style={{ color: "var(--about-brand)" }}
            >
              Founder &amp; CEO
            </p>

            <div
              className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
              style={{ color: "var(--about-muted)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" strokeWidth={1.75} />
                Chicago, IL
              </span>
              <span
                aria-hidden
                className="h-1 w-1 rounded-full"
                style={{ background: "var(--about-line)" }}
              />
              <span>Vision &amp; product</span>
            </div>

            <blockquote
              className="about-serif mt-7 text-2xl italic leading-snug md:text-[26px]"
              style={{ color: "var(--about-ink)" }}
            >
              <span
                style={{ color: "var(--about-brand)" }}
                className="mr-1 not-italic"
              >
                &ldquo;
              </span>
              We build the workspace we always wished we had.
            </blockquote>

            <div
              className="mt-7 space-y-4 text-[15px] leading-[1.8]"
              style={{ color: "var(--about-ink)" }}
            >
              <p>
                Elena started the company after a decade leading revenue teams,
                frustrated that great campaigns kept dying in messy handoffs
                between marketing, sales, and design. She wanted one place where
                a good idea could go from a sketch to a live, on-brand page
                without a dozen approvals.
              </p>
              <p style={{ color: "var(--about-muted)" }}>
                Today she sets product direction and still spends most of her
                week with customers, turning their hardest workflows into the
                features the whole team builds around.
              </p>
            </div>

            <div
              className="mt-8 flex items-center gap-2"
              style={{ color: "var(--about-muted)" }}
            >
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                aria-label="Elena Marsh on LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ outline: "1px solid var(--about-line)" }}
              >
                <Linkedin className="h-4 w-4" strokeWidth={1.75} />
              </a>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                aria-label="Email Elena Marsh"
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ outline: "1px solid var(--about-line)" }}
              >
                <Mail className="h-4 w-4" strokeWidth={1.75} />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
