import { useState, useRef, useCallback, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import type { EventPageBlockProps } from "@/lib/block-types";
import type { FormField } from "@/lib/block-types";

// Design tokens for the dark luxury palette
const C = {
  bg: "#0c0f12",
  card: "#141619",
  fg: "#eeeae3",
  primary: "#b59a6e",
  primaryDim: "rgba(181,154,110,0.8)",
  muted: "#7a8088",
  mutedDim: "rgba(122,128,136,0.5)",
  border: "#262a2f",
  borderDim: "rgba(38,42,47,0.5)",
  overlay: "linear-gradient(180deg, rgba(12,15,18,0.5) 0%, rgba(12,15,18,0.85) 100%)",
} as const;

const EASE_SPRING = { type: "spring", stiffness: 400, damping: 17 } as const;

// Inject EB Garamond font once per page
function useEBGaramond() {
  useEffect(() => {
    const id = "eb-garamond-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Inter:wght@300;400;500&display=swap";
    document.head.appendChild(link);
  }, []);
}

// Shared Framer Motion variants
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
};

// Bottom-border-only select dropdown
function CustomSelect({
  value, onChange, options, placeholder, focusedField, setFocusedField, name, required,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
  focusedField: string | null; setFocusedField: (f: string | null) => void;
  name: string; required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusedField(null);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [setFocusedField]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setFocusedField(open ? null : name); }}
        style={{ color: value ? C.fg : C.mutedDim, borderBottom: `1px solid ${C.border}` }}
        className="w-full bg-transparent py-3 text-left text-sm flex items-center justify-between focus:outline-none transition-all duration-300"
      >
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300 }}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: C.mutedDim }}
        />
      </button>
      {required && !value && (
        <input tabIndex={-1} className="absolute inset-0 opacity-0 pointer-events-none" value={value} onChange={() => {}} required />
      )}
      <motion.div
        className="absolute bottom-0 left-0 h-px origin-left"
        style={{ backgroundColor: C.primary }}
        animate={{ scaleX: focusedField === name ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      {open && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 shadow-xl"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); setFocusedField(null); }}
              className="w-full text-left px-4 py-3 text-sm transition-colors duration-200"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 300,
                color: value === opt ? C.primary : C.fg,
                backgroundColor: value === opt ? "rgba(181,154,110,0.05)" : "transparent",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = value === opt ? "rgba(181,154,110,0.05)" : "transparent"; }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Main block component
interface Props {
  props: EventPageBlockProps;
  pageId?: number;
  variantId?: number;
  sessionId?: string;
}

export function BlockEventPage({ props: p, pageId, variantId, sessionId }: Props) {
  useEBGaramond();

  const displayFont = "'EB Garamond', serif";
  const bodyFont = "'Inter', sans-serif";

  // Hero parallax scroll state
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroImgY = useTransform(heroScroll, [0, 1], ["0%", "30%"]);
  const heroImgScale = useTransform(heroScroll, [0, 1], [1, 1.15]);
  const heroOverlay = useTransform(heroScroll, [0, 0.5], [0.6, 0.95]);
  const heroContentY = useTransform(heroScroll, [0, 1], ["0%", "20%"]);
  const heroContentOpacity = useTransform(heroScroll, [0, 0.6], [1, 0]);

  // Photo carousel state
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center", slidesToScroll: 1 });
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [hoveredPhoto, setHoveredPhoto] = useState<number | null>(null);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCarouselIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || hoveredPhoto !== null) return;
    const interval = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => clearInterval(interval);
  }, [emblaApi, hoveredPhoto]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // RSVP form state
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of p.formSteps) {
      for (const f of s.fields) {
        init[f.id] = f.defaultValue ?? "";
      }
    }
    return init;
  });

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const handleFieldChange = (id: string, type: string, value: string) => {
    setFormValues(prev => ({ ...prev, [id]: type === "phone" ? formatPhone(value) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fields: Record<string, string> = {};
    for (const s of p.formSteps) {
      for (const f of s.fields) {
        fields[f.label] = (formValues[f.id] ?? "").trim();
      }
    }

    try {
      const submitUrl = p.formSubmitUrl?.trim() || "/api/lp/leads";
      if (pageId != null || p.formSubmitUrl) {
        const resp = await fetch(submitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields, pageId, variantId, sessionId }),
        });
        if (!resp.ok) throw new Error("Submission failed");

        try {
          await fetch("/api/lp/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sessionId ?? `anon-${Date.now()}`,
              testId: 0,
              variantId: variantId ?? 0,
              eventType: "conversion",
              conversionType: "form_submit",
            }),
          });
        } catch (err) {
          console.error("Form tracking error:", err);
        }

        try {
          const hlRaw = sessionStorage.getItem("hl_ctx");
          if (hlRaw) {
            const hlCtx = JSON.parse(hlRaw) as { hotlinkId: number; contactId: number; accountId: number | null; token: string };
            await fetch("/api/sales/signals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "form_submit",
                source: "microsite",
                hotlinkId: hlCtx.hotlinkId,
                contactId: hlCtx.contactId,
                accountId: hlCtx.accountId,
                metadata: { pageId, fields: Object.keys(fields) },
              }),
            });
          }
        } catch (err) {
          console.error("Sales signal error:", err);
        }
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Shared input base styles
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    borderBottom: `1px solid ${C.border}`,
    color: C.fg,
    fontFamily: bodyFont,
    fontWeight: 300,
    fontSize: "0.875rem",
    padding: "0.75rem 0",
    outline: "none",
    transition: "border-color 0.3s",
  };

  const renderField = (field: FormField) => {
    const isFocused = focusedField === field.id;
    const value = formValues[field.id] ?? "";

    if (field.type === "select") {
      return (
        <CustomSelect
          key={field.id}
          value={value}
          onChange={v => handleFieldChange(field.id, "select", v)}
          options={field.options ?? []}
          placeholder={field.placeholder ?? field.label}
          name={field.id}
          required={field.required}
          focusedField={focusedField}
          setFocusedField={setFocusedField}
        />
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.id} style={{ position: "relative" }}>
          <textarea
            name={field.id}
            value={value}
            onChange={e => handleFieldChange(field.id, "textarea", e.target.value)}
            onFocus={() => setFocusedField(field.id)}
            onBlur={() => setFocusedField(null)}
            required={field.required}
            placeholder={field.placeholder ?? field.label}
            rows={3}
            style={{ ...inputStyle, resize: "none" }}
            className="placeholder:text-[rgba(122,128,136,0.4)] focus:outline-none"
          />
          <motion.div style={{ position: "absolute", bottom: 0, left: 0, height: "1px", backgroundColor: C.primary, transformOrigin: "left" }} animate={{ scaleX: isFocused ? 1 : 0 }} transition={{ duration: 0.3 }} />
        </div>
      );
    }

    const inputType = field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";

    return (
      <div key={field.id} style={{ position: "relative" }}>
        <input
          type={inputType}
          name={field.id}
          value={value}
          onChange={e => handleFieldChange(field.id, field.type, e.target.value)}
          onFocus={() => setFocusedField(field.id)}
          onBlur={() => setFocusedField(null)}
          required={field.required}
          placeholder={field.placeholder ?? field.label}
          style={{ ...inputStyle }}
          className="placeholder:text-[rgba(122,128,136,0.4)] focus:outline-none"
        />
        <motion.div style={{ position: "absolute", bottom: 0, left: 0, height: "1px", backgroundColor: C.primary, transformOrigin: "left" }} animate={{ scaleX: isFocused ? 1 : 0 }} transition={{ duration: 0.3 }} />
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: C.bg, color: C.fg, fontFamily: bodyFont }}>

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "1.25rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "rgba(12,15,18,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {p.logoUrl ? (
          <img src={p.logoUrl} alt="Logo" style={{ height: "1.25rem", width: "auto" }} />
        ) : (
          <span style={{ fontFamily: displayFont, fontSize: "1.1rem", color: C.fg, letterSpacing: "0.05em" }}>
            {p.eventName}
          </span>
        )}
        {p.navLinks.length > 0 && (
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            {p.navLinks.map(link => (
              <motion.a
                key={link.href}
                href={link.href}
                style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(238,234,227,0.5)", textDecoration: "none" }}
                whileHover={{ color: C.fg }}
                transition={EASE_SPRING}
              >
                {link.label}
              </motion.a>
            ))}
          </div>
        )}
        <motion.a
          href={p.navCtaUrl}
          style={{
            fontFamily: bodyFont,
            fontWeight: 300,
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(238,234,227,0.7)",
            textDecoration: "none",
            transition: "color 0.3s",
          }}
          whileHover={{ scale: 1.05, color: C.primary }}
          transition={EASE_SPRING}
        >
          {p.navCtaText}
        </motion.a>
      </motion.nav>

      {/* Hero */}
      <section
        ref={heroRef}
        style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      >
        {/* Parallax background */}
        <motion.div style={{ position: "absolute", inset: 0, y: heroImgY }}>
          <motion.img
            src={p.heroImageUrl || "https://raw.githubusercontent.com/charlottecarey-droid/ID2/main/src/assets/hero-provo.jpg"}
            alt="Hero background"
            style={{ width: "100%", height: "100%", objectFit: "cover", scale: heroImgScale }}
          />
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              background: C.overlay,
              opacity: heroOverlay,
            }}
          />
        </motion.div>

        {/* Content */}
        <motion.div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            maxWidth: "42rem",
            margin: "0 auto",
            padding: "0 1.5rem",
            y: heroContentY,
            opacity: heroContentOpacity,
          }}
        >
          <motion.p
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.4em", textTransform: "uppercase", color: C.primary, marginBottom: "2rem" }}
          >
            {p.heroEyebrow}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            style={{ fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(3rem, 8vw, 5.5rem)", lineHeight: 1.1, marginBottom: "1rem", color: C.fg }}
          >
            {p.eventName}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.75rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "hsl(38 25% 72%)", marginBottom: "1.5rem" }}
          >
            {p.eventSubtitle}
          </motion.p>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 1.1 }}
            style={{ width: "3rem", height: "1px", backgroundColor: "rgba(181,154,110,0.4)", margin: "0 auto 2rem", transformOrigin: "center" }}
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: C.muted, maxWidth: "28rem", margin: "0 auto 2rem", lineHeight: 1.7 }}
          >
            {p.heroTagline}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.65rem", color: "rgba(122,128,136,0.6)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "3rem" }}
          >
            {p.heroLocation}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.6 }}>
            <motion.a
              href={p.navCtaUrl}
              style={{
                display: "inline-block",
                position: "relative",
                padding: "1rem 2.5rem",
                backgroundColor: "rgba(181,154,110,0.9)",
                color: C.bg,
                fontFamily: bodyFont,
                fontWeight: 400,
                fontSize: "0.7rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                textDecoration: "none",
                overflow: "hidden",
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={EASE_SPRING}
            >
              <motion.span
                style={{ position: "absolute", inset: 0, backgroundColor: C.primary }}
                initial={{ x: "-100%" }}
                whileHover={{ x: "0%" }}
                transition={{ duration: 0.4 }}
              />
              <span style={{ position: "relative", zIndex: 10 }}>{p.heroCtaText}</span>
            </motion.a>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 2.5 }}
          style={{ position: "absolute", bottom: "2.5rem", left: "50%", transform: "translateX(-50%)" }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: "1px", height: "2.5rem", background: `linear-gradient(to bottom, rgba(181,154,110,0.4), transparent)` }}
          />
        </motion.div>
      </section>

      {/* Agenda */}
      <section id="agenda" style={{ padding: "7rem 1.5rem", backgroundColor: C.bg }}>
        <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={stagger} style={{ textAlign: "center", marginBottom: "5rem" }}
          >
            <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.4em", textTransform: "uppercase", color: C.primary, marginBottom: "1.25rem" }}>
              {p.agendaEyebrow}
            </motion.p>
            <motion.h2 variants={fadeUp} style={{ fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(1.875rem, 5vw, 3rem)", color: C.fg, marginBottom: "1.5rem" }}>
              {p.agendaHeadline}
            </motion.h2>
            <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: C.muted, maxWidth: "32rem", margin: "0 auto", lineHeight: 1.7 }}>
              {p.agendaSubtitle}
            </motion.p>
          </motion.div>

          {/* Value props */}
          {p.agendaValueProps && p.agendaValueProps.length > 0 && (
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.75rem 2rem", marginBottom: "4rem" }}
            >
              {p.agendaValueProps.map((vp, i) => (
                <motion.span
                  key={i} variants={fadeUp}
                  whileHover={{ scale: 1.05, color: "hsl(38 25% 72%)" }}
                  style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(181,154,110,0.8)", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "default" }}
                >
                  <motion.span style={{ width: "0.25rem", height: "0.25rem", borderRadius: "50%", backgroundColor: "rgba(181,154,110,0.6)", display: "inline-block" }} whileHover={{ scale: 2 }} />
                  {vp}
                </motion.span>
              ))}
            </motion.div>
          )}

          {/* Days */}
          <div style={{ borderTop: `1px solid rgba(38,42,47,0.5)` }}>
            {p.agendaDays.map((day, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.8, delay: i * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr",
                  gap: "3rem",
                  padding: "3rem 0",
                  borderBottom: `1px solid rgba(38,42,47,0.5)`,
                }}
                className="group max-sm:grid-cols-1 max-sm:gap-4"
              >
                <div>
                  <motion.p
                    whileHover={{ letterSpacing: "0.4em" }}
                    transition={{ duration: 0.3 }}
                    style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: C.primary, marginBottom: "0.25rem" }}
                  >
                    {day.day}
                  </motion.p>
                </div>
                <div>
                  <h3
                    style={{ fontFamily: displayFont, fontWeight: 400, fontStyle: "italic", fontSize: "1.5rem", color: C.fg, marginBottom: "1rem", transition: "color 0.5s" }}
                    className="group-hover:text-[#b59a6e]"
                  >
                    {day.title}
                  </h3>
                  <p style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: C.muted, lineHeight: 1.7, marginBottom: "1rem" }}>
                    {day.description}
                  </p>
                  <motion.div
                    initial={{ width: 0 }} whileInView={{ width: "3rem" }} viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.15 }}
                    style={{ height: "1px", backgroundColor: "rgba(181,154,110,0.3)", marginBottom: "1rem" }}
                  />
                  {day.highlight && (
                    <p style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: "rgba(122,128,136,0.8)", lineHeight: 1.7 }}>
                      {day.highlight}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo Carousel */}
      <section id="photos" style={{ padding: "5rem 0", backgroundColor: C.bg, overflow: "hidden" }}>
        <motion.div
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ duration: 1 }} style={{ position: "relative" }}
        >
          <div className="overflow-hidden cursor-grab active:cursor-grabbing" ref={emblaRef}>
            <div style={{ display: "flex" }}>
              {p.photos.map((photo, i) => (
                <div key={i} style={{ flex: "0 0 85%", minWidth: 0, padding: "0 0.75rem" }} className="md:flex-[0_0_60%]">
                  <motion.div
                    style={{ position: "relative", overflow: "hidden", aspectRatio: "16/9" }}
                    onHoverStart={() => setHoveredPhoto(i)}
                    onHoverEnd={() => setHoveredPhoto(null)}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <motion.img
                      src={photo.src}
                      alt={photo.alt}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="lazy"
                      animate={{ scale: hoveredPhoto === i ? 1.08 : 1 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(12,15,18,0.8), rgba(12,15,18,0.1) 40%, transparent)", transition: "all 0.5s" }} />

                    {/* Caption */}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "1.25rem" }}>
                      <motion.p
                        style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(238,234,227,0.8)" }}
                        animate={{ y: hoveredPhoto === i ? -4 : 0, opacity: hoveredPhoto === i ? 1 : 0.8 }}
                        transition={{ duration: 0.3 }}
                      >
                        {photo.caption}
                      </motion.p>
                      <motion.div
                        style={{ height: "1px", backgroundColor: "rgba(181,154,110,0.4)", marginTop: "0.75rem", transformOrigin: "left" }}
                        animate={{ scaleX: hoveredPhoto === i ? 1 : 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>

                    {/* Corner accents */}
                    <motion.div
                      style={{ position: "absolute", top: "1rem", right: "1rem", width: "1.5rem", height: "1.5rem", borderTop: "1px solid", borderRight: "1px solid" }}
                      animate={{ borderColor: hoveredPhoto === i ? "rgba(181,154,110,0.5)" : "rgba(181,154,110,0)" }}
                      transition={{ duration: 0.4 }}
                    />
                    <motion.div
                      style={{ position: "absolute", bottom: "1rem", left: "1rem", width: "1.5rem", height: "1.5rem", borderBottom: "1px solid", borderLeft: "1px solid" }}
                      animate={{ borderColor: hoveredPhoto === i ? "rgba(181,154,110,0.5)" : "rgba(181,154,110,0)" }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                    />
                  </motion.div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.5rem", marginTop: "2rem" }}>
            <motion.button
              onClick={scrollPrev} aria-label="Previous photo"
              style={{ width: "2.5rem", height: "2.5rem", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}`, color: C.muted, background: "transparent", cursor: "pointer", transition: "color 0.3s, border-color 0.3s" }}
              whileHover={{ scale: 1.1, borderColor: "rgba(181,154,110,0.5)", color: C.primary }}
              whileTap={{ scale: 0.9 }}
              transition={EASE_SPRING}
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {p.photos.map((_, i) => (
                <motion.button
                  key={i}
                  style={{ width: "0.375rem", height: "0.375rem", borderRadius: "50%", border: "none", cursor: "pointer", padding: 0 }}
                  animate={{
                    backgroundColor: i === carouselIdx ? C.primary : "rgba(38,42,47,0.5)",
                    scale: i === carouselIdx ? 1.4 : 1,
                  }}
                  whileHover={{ scale: 1.6 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => emblaApi?.scrollTo(i)}
                  aria-label={`Go to photo ${i + 1}`}
                />
              ))}
            </div>

            <motion.button
              onClick={scrollNext} aria-label="Next photo"
              style={{ width: "2.5rem", height: "2.5rem", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}`, color: C.muted, background: "transparent", cursor: "pointer", transition: "color 0.3s, border-color 0.3s" }}
              whileHover={{ scale: 1.1, borderColor: "rgba(181,154,110,0.5)", color: C.primary }}
              whileTap={{ scale: 0.9 }}
              transition={EASE_SPRING}
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Details */}
      <section id="details" style={{ padding: "7rem 1.5rem", backgroundColor: C.card }}>
        <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={stagger} style={{ textAlign: "center", marginBottom: "4rem" }}
          >
            <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.4em", textTransform: "uppercase", color: C.primary, marginBottom: "1.25rem" }}>
              {p.detailsEyebrow}
            </motion.p>
            <motion.h2 variants={fadeUp} style={{ fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(1.875rem, 5vw, 3rem)", color: C.fg, marginBottom: "1.25rem" }}>
              {p.detailsHeadline}
            </motion.h2>
            <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: C.muted, maxWidth: "32rem", margin: "0 auto", lineHeight: 1.7 }}>
              {p.detailsSubtitle}
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", border: `1px solid rgba(38,42,47,0.3)`, backgroundColor: "rgba(38,42,47,0.3)" }}
            className="max-sm:grid-cols-1"
          >
            {p.details.map((detail, i) => (
              <motion.div
                key={i} variants={fadeUp}
                whileHover={{ backgroundColor: "hsl(210 10% 11%)" }}
                transition={{ duration: 0.4 }}
                style={{ textAlign: "center", padding: "3rem 1.5rem", backgroundColor: C.card, cursor: "default" }}
                className="group"
              >
                <p style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted, marginBottom: "1rem", transition: "color 0.4s" }}
                  className="group-hover:text-[#b59a6e]"
                >
                  {detail.label}
                </p>
                <p style={{ fontFamily: displayFont, fontStyle: "italic", fontSize: "1.25rem", color: C.fg, marginBottom: "0.5rem" }}>
                  {detail.value}
                </p>
                <p style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.75rem", color: C.muted }}>
                  {detail.sub}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* RSVP */}
      <section id="rsvp" style={{ padding: "7rem 1.5rem", backgroundColor: C.bg, position: "relative", overflow: "hidden" }}>
        {/* Ambient glow */}
        <motion.div
          style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "600px", height: "600px", borderRadius: "50%", opacity: 0.03,
            background: "radial-gradient(circle, hsl(38 35% 58%) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <div style={{ maxWidth: "36rem", margin: "0 auto", position: "relative", zIndex: 10 }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={stagger} style={{ textAlign: "center", marginBottom: "3.5rem" }}
          >
            <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.4em", textTransform: "uppercase", color: C.primary, marginBottom: "1.25rem" }}>
              {p.rsvpEyebrow}
            </motion.p>
            <motion.h2 variants={fadeUp} style={{ fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(1.875rem, 5vw, 3rem)", color: C.fg, marginBottom: "1.25rem" }}>
              {p.rsvpHeadline}
            </motion.h2>
            <motion.p variants={fadeUp} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: C.muted, maxWidth: "28rem", margin: "0 auto", lineHeight: 1.7 }}>
              {p.rsvpSubtitle}
            </motion.p>
          </motion.div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              style={{ textAlign: "center", padding: "4rem 2rem", border: `1px solid rgba(181,154,110,0.3)`, position: "relative", overflow: "hidden" }}
            >
              <motion.div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(181,154,110,0.05)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, delay: 0.5 }} style={{ width: "3rem", height: "1px", backgroundColor: "rgba(181,154,110,0.5)", margin: "0 auto 1.5rem", transformOrigin: "center" }} />
              <p style={{ fontFamily: displayFont, fontStyle: "italic", fontSize: "1.5rem", color: C.fg, marginBottom: "0.75rem", position: "relative", zIndex: 10 }}>
                Thank you for your interest
              </p>
              <p style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.875rem", color: C.muted, position: "relative", zIndex: 10, maxWidth: "22rem", margin: "0 auto", lineHeight: 1.7 }}>
                Your request has been received. A member of our team will review your submission and confirm your reservation shortly.
              </p>
            </motion.div>
          ) : (
            <motion.form
              key={step}
              initial={{ opacity: 0, x: step === 1 ? 0 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              onSubmit={step < p.formSteps.length ? (e) => { e.preventDefault(); setStep(s => s + 1); } : handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
            >
              {/* Step indicator — only shown when there are multiple steps */}
              {p.formSteps.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                  {p.formSteps.map((_, i) => (
                    <span key={i} style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: step === i + 1 ? C.primary : C.mutedDim }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )).reduce((acc: React.ReactNode[], el, i, arr) => {
                    acc.push(el);
                    if (i < arr.length - 1) {
                      acc.push(
                        <div key={`divider-${i}`} style={{ width: "2rem", height: "1px", backgroundColor: C.border, position: "relative" }}>
                          <motion.div style={{ position: "absolute", inset: "0", left: 0, backgroundColor: C.primary }} animate={{ width: step > i + 1 ? "100%" : "0%" }} transition={{ duration: 0.4 }} />
                        </div>
                      );
                    }
                    return acc;
                  }, [])}
                </div>
              )}

              {/* Current step fields */}
              {(p.formSteps[step - 1]?.fields ?? []).map(field => renderField(field))}

              {/* Error */}
              {error && step === p.formSteps.length && (
                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ fontFamily: bodyFont, fontSize: "0.875rem", color: "#ef4444" }}>
                  {error}
                </motion.p>
              )}

              {/* Navigation buttons */}
              {step > 1 ? (
                <div style={{ display: "flex", gap: "1rem" }}>
                  <motion.button
                    type="button" onClick={() => setStep(s => s - 1)}
                    style={{ padding: "1rem 1.5rem", border: `1px solid ${C.border}`, color: "rgba(238,234,227,0.7)", fontFamily: bodyFont, fontWeight: 300, fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", background: "transparent", cursor: "pointer", transition: "all 0.3s" }}
                    whileHover={{ scale: 1.01, borderColor: "rgba(181,154,110,0.5)", color: C.fg }}
                    whileTap={{ scale: 0.99 }}
                  >
                    Back
                  </motion.button>
                  <SubmitBtn label={step < p.formSteps.length ? "Continue" : "Reserve My Seat"} loading={loading} flex1 />
                </div>
              ) : (
                <SubmitBtn label={p.formSteps.length > 1 ? "Continue" : "Reserve My Seat"} loading={loading} />
              )}
            </motion.form>
          )}
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        style={{ padding: "4rem 1.5rem", borderTop: `1px solid rgba(38,42,47,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}
      >
        <p style={{ fontFamily: bodyFont, fontWeight: 300, fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(122,128,136,0.6)" }}>
          {p.footerText}
        </p>
      </motion.footer>
    </div>
  );
}

// Animated submit button helper
function SubmitBtn({ label, loading, flex1 }: { label: string; loading: boolean; flex1?: boolean }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      style={{
        flex: flex1 ? 1 : undefined,
        width: flex1 ? undefined : "100%",
        padding: "1rem",
        backgroundColor: "rgba(181,154,110,0.9)",
        color: "#0c0f12",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 400,
        fontSize: "0.7rem",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        overflow: "hidden",
        position: "relative",
        opacity: loading ? 0.5 : 1,
      }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <motion.span
        style={{ position: "absolute", inset: 0, backgroundColor: "#b59a6e" }}
        initial={{ x: "-100%" }}
        whileHover={{ x: "0%" }}
        transition={{ duration: 0.4 }}
      />
      <span style={{ position: "relative", zIndex: 10 }}>{loading ? "Reserving…" : label}</span>
    </motion.button>
  );
}
