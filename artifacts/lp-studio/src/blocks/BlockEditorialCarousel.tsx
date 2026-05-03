import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import type {
  EditorialCarouselBlockProps,
  EditorialCarouselSlide,
} from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";

interface Props {
  props: EditorialCarouselBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: EditorialCarouselBlockProps) => void;
}

const EASE_SPRING = { type: "spring", stiffness: 400, damping: 17 } as const;

/** Mix any CSS color (hex, rgb, var(--brand-accent), …) with transparent.
 *  Replaces the old hex-only `alpha()` helper so callers can pass brand CSS
 *  variables and not just literal hex codes. */
function alpha(color: string, a: number): string {
  const pct = Math.max(0, Math.min(1, a)) * 100;
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export function BlockEditorialCarousel({ props, brand: _brand, onFieldChange }: Props) {
  // Defaults flow from brand tokens so the block follows brand settings out of
  // the box. Authors can still override per-block via the property panel.
  const bg = props.bgColor || "var(--brand-primary, #0c0f12)";
  // Default text uses on-primary (auto-contrasted against the brand primary
  // background) so the warm cream isn't burned in when a tenant has, say,
  // a white brand primary. Authors can still override.
  const text = props.textColor || "var(--brand-on-primary, #eeeae3)";
  const accent = props.accentColor || "var(--brand-accent, #b59a6e)";
  const border = props.borderColor || "var(--brand-border, #262a2f)";
  const headlineFont =
    props.headlineFont || "var(--brand-font-display, 'Instrument Serif', 'EB Garamond', Georgia, serif)";
  const bodyFont = props.bodyFont || "var(--brand-font-body, 'Inter', sans-serif)";
  const aspect = props.aspect || "16/9";
  const slideWidthPct = Math.max(30, Math.min(95, props.slideWidthPct ?? 60));
  const autoplay = props.autoplay !== false;
  const interval = Math.max(1500, props.autoplayInterval ?? 5000);
  const rounded = props.rounded ?? false;
  const slides = props.slides ?? [];

  const field = (key: keyof EditorialCarouselBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateSlide = (i: number, patch: Partial<EditorialCarouselSlide>) => {
    if (!onFieldChange) return;
    onFieldChange({
      ...props,
      slides: slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  };

  // Embla
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    slidesToScroll: 1,
  });
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCarouselIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  // Auto-advance, paused while hovering a slide. Disabled in editor when
  // onFieldChange is provided so the author isn't fighting the carousel.
  useEffect(() => {
    if (!emblaApi || !autoplay || hovered !== null || onFieldChange) return;
    intervalRef.current = setInterval(() => emblaApi.scrollNext(), interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [emblaApi, hovered, autoplay, interval, onFieldChange]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const aspectStyle: CSSProperties = { aspectRatio: aspect };
  const radius = rounded ? "0.75rem" : "0";
  const dotInactive = alpha(border, 0.7);

  const hasHeader = !!(props.eyebrow || props.headline || props.subheadline || onFieldChange);

  return (
    <section style={{ backgroundColor: bg, color: text, padding: "5rem 0", overflow: "hidden", fontFamily: bodyFont }}>
      {hasHeader && (
        <div style={{ maxWidth: "56rem", margin: "0 auto 3.5rem", padding: "0 1.5rem", textAlign: "center" }}>
          {(props.eyebrow || onFieldChange) && (
            <p
              style={{
                fontWeight: 300,
                fontSize: "0.7rem",
                letterSpacing: "0.4em",
                textTransform: "uppercase",
                color: accent,
                marginBottom: "1.25rem",
              }}
            >
              <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
            </p>
          )}
          {(props.headline || onFieldChange) && (
            <h2
              style={{
                fontFamily: headlineFont,
                fontWeight: 400,
                fontSize: "clamp(1.875rem, 5vw, 3rem)",
                lineHeight: 1.1,
                color: text,
                marginBottom: "1rem",
                letterSpacing: "-0.01em",
              }}
            >
              <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            </h2>
          )}
          {(props.subheadline || onFieldChange) && (
            <p
              style={{
                fontWeight: 300,
                fontSize: "0.95rem",
                lineHeight: 1.7,
                color: alpha(text, 0.65),
                maxWidth: "32rem",
                margin: "0 auto",
              }}
            >
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        style={{ position: "relative" }}
      >
        <div
          className="overflow-hidden cursor-grab active:cursor-grabbing"
          ref={emblaRef}
        >
          <div style={{ display: "flex" }}>
            {slides.map((slide, i) => (
              <div
                key={i}
                style={{
                  flex: `0 0 85%`,
                  minWidth: 0,
                  padding: "0 0.75rem",
                }}
                className="md:!flex-[var(--ec-flex)]"
                // Custom property so the className-only desktop override
                // can read the configured slide width without re-rendering
                // a giant style sheet.
                ref={(el) => {
                  if (el) el.style.setProperty("--ec-flex", `0 0 ${slideWidthPct}%`);
                }}
              >
                <motion.div
                  style={{ position: "relative", overflow: "hidden", borderRadius: radius, ...aspectStyle }}
                  onHoverStart={() => setHovered(i)}
                  onHoverEnd={() => setHovered(null)}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  {onFieldChange ? (
                    <InlineImage
                      src={slide.src}
                      alt={slide.alt || ""}
                      wrapperClassName="absolute inset-0"
                      className="absolute inset-0 w-full h-full object-cover"
                      onUpdate={(url) => updateSlide(i, { src: url })}
                      onAltUpdate={(alt) => updateSlide(i, { alt })}
                    />
                  ) : (
                    <motion.img
                      src={slide.src}
                      alt={slide.alt || ""}
                      style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                      loading="lazy"
                      animate={{ scale: hovered === i ? 1.08 : 1 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  )}
                  {/* Bottom gradient scrim for caption legibility */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(to top, ${alpha(bg, 0.85)}, ${alpha(bg, 0.1)} 40%, transparent)`,
                      pointerEvents: "none",
                    }}
                  />

                  {/* Caption */}
                  {(slide.caption || onFieldChange) && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "1.25rem", zIndex: 2 }}>
                      <motion.p
                        style={{
                          fontWeight: 300,
                          fontSize: "0.7rem",
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          color: alpha(text, 0.85),
                          margin: 0,
                        }}
                        animate={{ y: hovered === i ? -4 : 0, opacity: hovered === i ? 1 : 0.85 }}
                        transition={{ duration: 0.3 }}
                      >
                        <InlineText
                          as="span"
                          value={slide.caption ?? ""}
                          onUpdate={onFieldChange ? (v) => updateSlide(i, { caption: v }) : undefined}
                        />
                      </motion.p>
                      <motion.div
                        style={{
                          height: "1px",
                          backgroundColor: alpha(accent, 0.6),
                          marginTop: "0.75rem",
                          transformOrigin: "left",
                        }}
                        animate={{ scaleX: hovered === i ? 1 : 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  )}

                  {/* Corner accents — top-right + bottom-left */}
                  <motion.div
                    style={{
                      position: "absolute",
                      top: "1rem",
                      right: "1rem",
                      width: "1.5rem",
                      height: "1.5rem",
                      borderTop: "1px solid",
                      borderRight: "1px solid",
                      pointerEvents: "none",
                    }}
                    animate={{ borderColor: hovered === i ? alpha(accent, 0.7) : alpha(accent, 0) }}
                    transition={{ duration: 0.4 }}
                  />
                  <motion.div
                    style={{
                      position: "absolute",
                      bottom: "1rem",
                      left: "1rem",
                      width: "1.5rem",
                      height: "1.5rem",
                      borderBottom: "1px solid",
                      borderLeft: "1px solid",
                      pointerEvents: "none",
                    }}
                    animate={{ borderColor: hovered === i ? alpha(accent, 0.7) : alpha(accent, 0) }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  />
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        {slides.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.5rem", marginTop: "2rem" }}>
            <motion.button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous slide"
              style={{
                width: "2.5rem",
                height: "2.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${border}`,
                color: alpha(text, 0.6),
                background: "transparent",
                cursor: "pointer",
                borderRadius: rounded ? "999px" : "0",
              }}
              whileHover={{ scale: 1.1, borderColor: alpha(accent, 0.6), color: accent }}
              whileTap={{ scale: 0.9 }}
              transition={EASE_SPRING}
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {slides.map((_, i) => (
                <motion.button
                  key={i}
                  type="button"
                  style={{
                    width: "0.375rem",
                    height: "0.375rem",
                    borderRadius: "50%",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  animate={{
                    backgroundColor: i === carouselIdx ? accent : dotInactive,
                    scale: i === carouselIdx ? 1.4 : 1,
                  }}
                  whileHover={{ scale: 1.6 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => emblaApi?.scrollTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            <motion.button
              type="button"
              onClick={scrollNext}
              aria-label="Next slide"
              style={{
                width: "2.5rem",
                height: "2.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${border}`,
                color: alpha(text, 0.6),
                background: "transparent",
                cursor: "pointer",
                borderRadius: rounded ? "999px" : "0",
              }}
              whileHover={{ scale: 1.1, borderColor: alpha(accent, 0.6), color: accent }}
              whileTap={{ scale: 0.9 }}
              transition={EASE_SPRING}
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </motion.div>
    </section>
  );
}
