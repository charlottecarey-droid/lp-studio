export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 paper-grain"
      style={{ background: "var(--cream)", color: "var(--ink)" }}
    >
      <div
        className="mb-4"
        style={{
          fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
          fontSize: "clamp(96px, 14vw, 168px)",
          lineHeight: 1,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          color: "var(--ink)",
        }}
      >
        404
      </div>
      <h1
        className="font-display mb-3"
        style={{
          color: "var(--ink)",
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        Page not found
      </h1>
      <p
        className="mb-8 text-[15px]"
        style={{ color: "var(--ink-soft)" }}
      >
        The page you're looking for doesn't exist.
      </p>
      <a
        href={import.meta.env.BASE_URL || "/"}
        className="px-5 py-2.5 text-[13.5px] font-medium transition-all"
        style={{
          background: "var(--ink)",
          color: "var(--cream)",
          borderRadius: 6,
          fontFamily: "'Inter', sans-serif",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-2, #2A2722)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ink)")}
      >
        Back to home
      </a>
    </div>
  );
}
