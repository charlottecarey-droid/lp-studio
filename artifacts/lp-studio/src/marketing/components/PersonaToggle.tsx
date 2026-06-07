import { Link } from "wouter";
import Icon from "./EmbedIcons";

// PersonaToggle — a presentation-only segmented switcher for the public
// marketing site, placed at the top of the /for-marketing and /for-sales
// solution pages (a two-segment "Marketing | Sales & RevOps" pill that leads
// the hero, replacing the old eyebrow). It mirrors the look of the in-app
// product mode toggle (sliding active background, Megaphone icon for Marketing,
// Target icon for Sales) but carries NO mode-context, auth, or plan-gating —
// it is a pure navigation control.
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
  { persona: "sales", href: "/for-sales", icon: "target", label: "Sales & RevOps" },
];

export default function PersonaToggle({ active }: PersonaToggleProps) {
  const isSales = active === "sales";

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: 5,
          borderRadius: 16,
          border: "1px solid rgba(26, 24, 21, 0.10)",
          background: "linear-gradient(180deg, #FFFFFF 0%, #F6F1E8 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(26, 24, 21, 0.04), 0 1px 2px rgba(26, 24, 21, 0.04), 0 10px 26px -12px rgba(26, 24, 21, 0.20)",
          width: 332,
        }}
      >
        {/* Sliding active background */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 5,
            bottom: 5,
            left: isSales ? "calc(50% + 2.5px)" : 5,
            width: "calc(50% - 7.5px)",
            borderRadius: 11,
            background: isSales
              ? "linear-gradient(180deg, color-mix(in srgb, var(--coral) 92%, #fff) 0%, var(--coral) 55%, color-mix(in srgb, var(--coral) 86%, #000) 100%)"
              : "linear-gradient(180deg, color-mix(in srgb, var(--indigo) 92%, #fff) 0%, var(--indigo) 55%, color-mix(in srgb, var(--indigo) 86%, #000) 100%)",
            boxShadow: isSales
              ? "inset 0 1px 0 rgba(255, 255, 255, 0.30), 0 6px 16px -6px color-mix(in srgb, var(--coral) 60%, transparent), 0 2px 5px color-mix(in srgb, var(--coral) 22%, transparent)"
              : "inset 0 1px 0 rgba(255, 255, 255, 0.30), 0 6px 16px -6px color-mix(in srgb, var(--indigo) 60%, transparent), 0 2px 5px color-mix(in srgb, var(--indigo) 22%, transparent)",
            transition: "left 220ms cubic-bezier(0.4, 0.0, 0.2, 1), background 200ms ease-out, box-shadow 200ms ease-out",
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
                gap: 8,
                padding: "9px 12px",
                borderRadius: 11,
                fontSize: 13.5,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                whiteSpace: "nowrap",
                textDecoration: "none",
                color: segActive ? "#fff" : "var(--ink-soft)",
                textShadow: segActive ? "0 1px 1px rgba(26, 24, 21, 0.18)" : "none",
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
