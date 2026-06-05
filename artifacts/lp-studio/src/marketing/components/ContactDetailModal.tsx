import { useEffect, useRef, useState } from "react";

// ContactDetailModal — renders the production /contacts/:id detail surface
// on top of IdentityWedge's analytics page when a visit row is clicked.
// Mirrors the real app view (header · Contact Information · AI Contact
// Brief · 4 metric cards · Personalized Links · Engagement History), with
// generic copy (no Dandy / dental references) so it lands as "this is what
// the app looks like" not "this is a Dandy screenshot."
//
// Contained within the AnalyticsMock container (position:absolute against
// the relative parent) — mirrors how NewMicrositeOverlay / CreatePageOverlay
// sit inside their browser frames, instead of covering the viewport. Escape
// still closes; backdrop click still closes.

export interface ContactDetail {
  name: string;
  /** Short role string under the name in the header */
  role: string;
  /** Big circular avatar initials (2 chars) */
  initials: string;
  /** Status pill in the header, e.g. "ENGAGED (3)" or "COLD (2)" */
  statusBadge: { label: string; tone: "engaged" | "cold" | "hot" };
  email: string;
  phone: string;
  account: string;
  linkedInLabel?: string; // default: "View Profile"
  status?: string; // default: "Active"
  /** AI Contact Brief — three keyed sections + a positioning angle */
  brief: {
    summary: string;
    whoTheyAre: string[];
    whatTheyCareAbout: string[];
    conversationStarters: string[];
    positioningAngle: string;
    lastUpdated: string;
  };
  metrics: { pageViews: number; emailOpens: number; emailClicks: number; formSubmits: number };
  personalizedLinks: { title: string; url: string }[];
  engagementHistory: { kind: "view" | "click" | "form"; label: string; meta: string; when: string }[];
}

interface Props {
  contact: ContactDetail;
  onClose: () => void;
}

export default function ContactDetailModal({ contact, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // AI Contact Brief is collapsed by default so the modal stays focused on
  // the engagement metrics + history — which is what the surrounding
  // "Know which person, not just which account" section is actually
  // demonstrating. The summary line still shows under the title; the
  // expanded sections (Who they are / What they care about / Conversation
  // starters / How to position) tuck behind a chevron toggle.
  const [briefExpanded, setBriefExpanded] = useState(false);

  // Escape to close + initial focus on the close button + simple Tab trap
  // so keyboard focus stays inside the contained dialog. No body scroll
  // lock — the modal is contained within the analytics section, not a
  // viewport overlay, so background scroll should keep working.
  useEffect(() => {
    // `preventScroll: true` keeps the browser from scrolling the modal
    // into view when focus moves to the close button. Without it, the
    // modal is pre-opened on John Donahoe at page mount and the focus
    // call yanks the viewport down to the IdentityWedge section on /for-
    // sales (and /new), which is jarring on landing.
    closeButtonRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${contact.name} — contact detail`}
      onClick={onClose}
      className="px-4 py-12 sm:p-6"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        background: "rgba(20,18,30,0.50)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 760,
          background: "#FAF7F0",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow:
            "0 24px 60px -16px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.6) inset",
          color: "var(--ink)",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Sales Console mini-chrome at top so it reads as the app */}
        <div
          style={{
            background: "#0F1A14",
            color: "#fff",
            padding: "10px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>lpstudio</span>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.65)",
              }}
            >
              Sales Console
            </span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 18, color: "rgba(255,255,255,0.85)" }}>
            <span>Accounts</span>
            <span>Microsites</span>
            <span>Activity</span>
            <span style={{ color: "#fff", fontWeight: 600 }}>Contacts</span>
            <span>Tools</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "26px 28px 32px" }}>
          {/* Header row: back · avatar · name + role + status badge · Generate CTA · close.
              On mobile the row wraps and the Generate CTA drops to its own
              full-width line (sm:* resets to the single-row desktop layout). */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                background: "transparent",
                border: "1px solid transparent",
                color: "var(--ink-mute)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 999,
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--indigo) 90%, transparent) 0%, color-mix(in srgb, var(--coral) 65%, transparent) 100%)",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "0.02em",
                flexShrink: 0,
              }}
            >
              {contact.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, minWidth: 0 }}>
                <h2
                  className="font-display"
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: "var(--ink)",
                    letterSpacing: "-0.022em",
                    margin: 0,
                  }}
                >
                  {contact.name}
                </h2>
                <StatusBadge {...contact.statusBadge} />
              </div>
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  color: "var(--ink-mute)",
                  marginTop: 4,
                }}
              >
                {contact.role}
              </div>
            </div>
            <button
              type="button"
              className="order-1 w-full justify-center sm:order-none sm:w-auto sm:justify-start"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                background: "var(--ink)",
                color: "var(--cream)",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 14px -4px rgba(26,24,21,0.4)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3l1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5z" />
              </svg>
              Generate Microsite
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close contact detail"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "transparent",
                border: "1px solid transparent",
                color: "var(--ink-mute)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contact Information card */}
          <Card>
            <CardHeading>Contact Information</CardHeading>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                rowGap: 18,
                columnGap: 24,
              }}
            >
              <Field icon="mail" label="Email" value={contact.email} />
              <Field icon="phone" label="Phone" value={contact.phone} />
              <Field
                icon="linkedin"
                label="LinkedIn"
                value={contact.linkedInLabel ?? "View Profile"}
                link
              />
              <Field
                icon="building"
                label="Account"
                value={contact.account}
                link
              />
              <Field
                icon="pulse"
                label="Status"
                value={contact.status ?? "Active"}
              />
            </div>
          </Card>

          {/* AI Contact Brief — collapsed by default so the modal stays
              focused on the engagement metrics + history. The whole header
              row toggles expand/collapse. */}
          <Card style={{ marginTop: 16, padding: briefExpanded ? "20px 24px" : "14px 18px" }}>
            <button
              type="button"
              onClick={() => setBriefExpanded((v) => !v)}
              aria-expanded={briefExpanded}
              aria-controls="ai-contact-brief-body"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                background: "transparent",
                border: "none",
                padding: 0,
                margin: 0,
                cursor: "pointer",
                textAlign: "left",
                color: "inherit",
                font: "inherit",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "color-mix(in srgb, var(--indigo) 14%, transparent)",
                  color: "var(--indigo)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.5 2A3.5 3.5 0 006 5.5v1.04A3.5 3.5 0 003 10a3.5 3.5 0 002 3.16V14.5A3.5 3.5 0 005.5 18 3.5 3.5 0 009 21.5h6a3.5 3.5 0 003.5-3.5 3.5 3.5 0 00.5-1.84V13.16A3.5 3.5 0 0021 10a3.5 3.5 0 00-3-3.46V5.5A3.5 3.5 0 0014.5 2h-5z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.005em" }}>
                  AI Contact Brief
                </div>
                <p style={{ fontSize: 12.5, color: "var(--ink-mute)", margin: "3px 0 0", lineHeight: 1.5 }}>
                  {contact.brief.summary}
                </p>
              </div>
              <span
                aria-hidden="true"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid var(--hairline-strong)",
                  color: "var(--ink-mute)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 0,
                  transform: briefExpanded ? "rotate(180deg)" : "none",
                  transition: "transform 180ms ease",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            {briefExpanded && (
              <div id="ai-contact-brief-body" style={{ marginTop: 18 }}>
                <BriefSection label="Who they are" items={contact.brief.whoTheyAre} />
                <BriefSection label="What they care about" items={contact.brief.whatTheyCareAbout} />
                <BriefSection label="Conversation starters" items={contact.brief.conversationStarters} numbered />

                {/* Positioning angle */}
                <div style={{ marginTop: 20 }}>
                  <SectionLabel>How to position</SectionLabel>
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "var(--ink-2)",
                      margin: 0,
                    }}
                  >
                    {contact.brief.positioningAngle}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 12,
                    borderTop: "1px solid var(--hairline)",
                    fontSize: 11,
                    color: "var(--ink-mute)",
                    textAlign: "right",
                    fontStyle: "italic",
                  }}
                >
                  Last updated {contact.brief.lastUpdated}
                </div>
              </div>
            )}
          </Card>

          {/* Metric cards */}
          <div
            className="grid grid-cols-2 md:grid-cols-4"
            style={{
              gap: 12,
              marginTop: 16,
            }}
          >
            <MetricCard label="Page Views" value={contact.metrics.pageViews} color="#2D7DD2" />
            <MetricCard label="Email Opens" value={contact.metrics.emailOpens} color="#E0903A" />
            <MetricCard label="Email Clicks" value={contact.metrics.emailClicks} color="#5C9B6E" />
            <MetricCard label="Form Submits" value={contact.metrics.formSubmits} color="#8967D0" />
          </div>

          {/* Personalized Links */}
          <div style={{ marginTop: 24 }}>
            <h3
              className="font-display"
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.018em",
                color: "var(--ink)",
                margin: "0 0 12px",
              }}
            >
              Personalized Links
            </h3>
            {contact.personalizedLinks.map((l) => (
              <div
                key={l.title}
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--hairline-strong)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: "color-mix(in srgb, var(--indigo) 14%, transparent)",
                    color: "var(--indigo)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007 0l4-4a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-4 4a5 5 0 007 7l1-1" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 13.5 }}>
                    {l.title}
                  </div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}
                  >
                    {l.url}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Copy link"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "transparent",
                    border: "1px solid var(--hairline-strong)",
                    color: "var(--ink-mute)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Open"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "transparent",
                    border: "1px solid var(--hairline-strong)",
                    color: "var(--ink-mute)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              style={{
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: "var(--paper)",
                border: "1px solid var(--hairline-strong)",
                borderRadius: 8,
                color: "var(--ink-2)",
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New personalized page
            </button>
          </div>

          {/* Engagement History */}
          <div style={{ marginTop: 24 }}>
            <h3
              className="font-display"
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.018em",
                color: "var(--ink)",
                margin: "0 0 12px",
              }}
            >
              Engagement History
            </h3>
            <div
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline-strong)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {contact.engagementHistory.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background:
                        e.kind === "view"
                          ? "color-mix(in srgb, #2D7DD2 14%, transparent)"
                          : e.kind === "click"
                          ? "color-mix(in srgb, #5C9B6E 14%, transparent)"
                          : "color-mix(in srgb, #8967D0 14%, transparent)",
                      color:
                        e.kind === "view"
                          ? "#2D7DD2"
                          : e.kind === "click"
                          ? "#5C9B6E"
                          : "#8967D0",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <EngagementIcon kind={e.kind} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                      {e.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
                      {e.meta}
                    </div>
                  </div>
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: "var(--ink-mute)",
                    }}
                  >
                    {e.when}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- pieces ----------

function StatusBadge({ label, tone }: { label: string; tone: "engaged" | "cold" | "hot" }) {
  const palette =
    tone === "engaged"
      ? { bg: "color-mix(in srgb, var(--indigo) 14%, transparent)", color: "var(--indigo)" }
      : tone === "hot"
      ? { bg: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)" }
      : { bg: "var(--cream-2)", color: "var(--ink-mute)" };
  return (
    <span
      className="font-mono uppercase"
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.18em",
        padding: "3px 8px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.color,
      }}
    >
      {label}
    </span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono uppercase"
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.18em",
        color: "var(--ink-mute)",
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono uppercase"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.18em",
        color: "var(--ink-mute)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function BriefSection({
  label,
  items,
  numbered,
}: {
  label: string;
  items: string[];
  numbered?: boolean;
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <SectionLabel>{label}</SectionLabel>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.map((it, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                color: "var(--ink-mute)",
                flexShrink: 0,
                width: numbered ? 16 : 8,
                fontWeight: numbered ? 600 : 700,
                lineHeight: 1.55,
              }}
            >
              {numbered ? `${i + 1})` : "—"}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  link,
}: {
  icon: "mail" | "phone" | "linkedin" | "building" | "pulse";
  label: string;
  value: string;
  link?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ color: "var(--ink-mute)", marginTop: 3, flexShrink: 0 }}>
        <FieldIcon name={icon} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: "var(--ink-mute)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 13.5,
            color: link ? "var(--indigo)" : "var(--ink)",
            fontWeight: link ? 600 : 500,
            wordBreak: "break-word",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function FieldIcon({ name }: { name: "mail" | "phone" | "linkedin" | "building" | "pulse" }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "mail":
      return (
        <svg {...props}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6L12 13 2 6" />
        </svg>
      );
    case "phone":
      return (
        <svg {...props}>
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.8a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.35 1.84.59 2.8.72A2 2 0 0122 16.92z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...props}>
          <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      );
    case "building":
      return (
        <svg {...props}>
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 12h.01M9 15h.01M9 18h.01" />
        </svg>
      );
    case "pulse":
      return (
        <svg {...props}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
  }
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 10,
        padding: "14px 18px",
        boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
      }}
    >
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </div>
      <div
        className="font-display"
        style={{
          marginTop: 6,
          fontSize: 28,
          fontWeight: 700,
          color,
          letterSpacing: "-0.025em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EngagementIcon({ kind }: { kind: "view" | "click" | "form" }) {
  const p = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "view") {
    return (
      <svg {...p}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (kind === "click") {
    return (
      <svg {...p}>
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    );
  }
  return (
    <svg {...p}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8" />
    </svg>
  );
}
