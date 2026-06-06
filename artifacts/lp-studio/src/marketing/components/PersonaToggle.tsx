import { Link } from "wouter";
import Icon from "./EmbedIcons";

// PersonaToggle — a presentation-only segmented switcher for the public
// marketing site, placed at the top of the /for-marketing and /for-sales
// solution pages (Clay-style: a small "LP STUDIO" label above a two-segment
// Marketing | Sales pill). It mirrors the look of the in-app product mode
// toggle (sliding active background, Megaphone icon for Marketing, Target icon
// for Sales) but carries NO mode-context, auth, or plan-gating — it is a pure
// navigation control.
//
// SSR-safe: the active segment is derived entirely from the `active` prop, so
// the prerendered static HTML and the hydrated client render the same markup —
// no flash, no hydration mismatch. There is no client-only state.

type Persona = "marketing" | "sales";

interface PersonaToggleProps {
  /** Which persona page this toggle currently sits on. */
  active: Persona;
}

const SEGMENTS: { persona: Persona; href: string; icon: string; label: string }[] = [
  { persona: "marketing", href: "/for-marketing", icon: "megaphone", label: "Marketing" },
  { persona: "sales", href: "/for-sales", icon: "target", label: "Sales" },
];

export default function PersonaToggle({ active }: PersonaToggleProps) {
  const isSales = active === "sales";

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 9,
        marginBottom: 26,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        LP Studio
      </span>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: 3,
          borderRadius: 12,
          border: "1px solid color-mix(in srgb, var(--ink) 12%, transparent)",
          background: "color-mix(in srgb, var(--ink) 4%, transparent)",
          width: 248,
        }}
      >
        {/* Sliding active background */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 3,
            bottom: 3,
            left: isSales ? "calc(50% + 1.5px)" : 3,
            width: "calc(50% - 4.5px)",
            borderRadius: 9,
            background: isSales ? "var(--coral)" : "var(--indigo)",
            boxShadow: "0 4px 12px -4px color-mix(in srgb, var(--ink) 30%, transparent)",
            transition: "left 200ms ease-out, background 200ms ease-out",
          }}
        />
        {SEGMENTS.map((seg) => {
          const segActive = seg.persona === active;
          return (
            <Link
              key={seg.persona}
              href={seg.href}
              aria-current={segActive ? "page" : undefined}
              style={{
                position: "relative",
                zIndex: 1,
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                padding: "8px 0",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                textDecoration: "none",
                color: segActive ? "#fff" : "var(--ink-soft)",
                transition: "color 150ms ease-out",
              }}
            >
              <Icon name={seg.icon} size={14} />
              {seg.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
