import { useState } from "react";
import { useInView } from "@/hooks/useInView";

export default function Waitlist() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  }

  const { ref, inView } = useInView();
  return (
    <section
      id="waitlist"
      className="px-6 py-20 md:py-28"
      style={{ background: "#000", borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        ref={ref}
        className="max-w-2xl mx-auto text-center"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: "rgba(199,231,56,0.08)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.18)" }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#C7E738" }} />
          Limited spots — join today
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
          Get early access <span style={{ color: "#C7E738" }}>today.</span>
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          Join hundreds of direct-response teams already on the waitlist. We'll send you access as we open new slots.
        </p>

        {submitted ? (
          <div
            className="rounded-2xl p-10 flex flex-col items-center gap-4"
            style={{ background: "rgba(199,231,56,0.06)", border: "1px solid rgba(199,231,56,0.25)" }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-2"
              style={{ background: "rgba(199,231,56,0.12)", color: "#C7E738" }}>
              ✓
            </div>
            <h3 className="text-2xl font-bold" style={{ fontFamily: "Outfit, sans-serif", color: "#C7E738" }}>
              You're on the list!
            </h3>
            <p className="text-gray-300 text-sm max-w-sm">
              Thanks <strong className="text-white">{name}</strong> — we'll reach out at <strong className="text-white">{email}</strong> when your spot is ready. Sit tight!
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl p-8 md:p-10 flex flex-col gap-4 text-left"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300" htmlFor="name">Your name</label>
              <input
                id="name"
                type="text"
                placeholder="Alex Johnson"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontFamily: "Inter, sans-serif"
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(199,231,56,0.5)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300" htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                placeholder="alex@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontFamily: "Inter, sans-serif"
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(199,231,56,0.5)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "#ff6b6b" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-base font-bold transition-all mt-2"
              style={{
                background: loading ? "rgba(199,231,56,0.5)" : "#C7E738",
                color: "#000",
                fontFamily: "Outfit, sans-serif",
                cursor: loading ? "not-allowed" : "pointer"
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#d6f54a"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#C7E738"; }}
            >
              {loading ? "Joining..." : "Join the Waitlist — It's Free"}
            </button>

            <p className="text-xs text-gray-500 text-center">No credit card required. Unsubscribe any time.</p>
          </form>
        )}
      </div>
    </section>
  );
}
