import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, Gift, Snowflake } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { mixHex } from "@/lib/section-ink";
import { INVITE_BODY, INVITE_DISPLAY, INVITE_PILL_CLASS, pillStyle } from "@/lib/invite-theme";
import type { GiftHeroBlockProps } from "../BlockGiftHero";
import { GIFT_CSS, Snowfall, resolveGiftPalette } from "./gift-theme";
import { ATELIER_BUTTON_CLASS, ATELIER_CSS, ATELIER_SERIF, SatinBand, SatinBow, resolveAtelierPalette } from "./atelier-theme";
import { RepSignoff } from "./RepSignoff";
import { setEnvelopeActive, useGiftNoteStore, type GiftNoteContent } from "./note-store";
import { cn } from "@/lib/utils";

/**
 * gift-hero with `envelopeIntro: true` (live page only): the page opens on a
 * sealed envelope addressed to the visitor. "Open card" (or a click on the
 * envelope) lifts the flap, the card rises out, then settles full-size in
 * the centre showing the note — the gift-note block's own content when the
 * page has one (that block then hides itself), else the hero's headline and
 * subheadline. A "Choose your gift" button and chevron lead down to the
 * picker. Reduced motion skips straight to the card; a return visit in the
 * same tab starts on the open card.
 */

type Phase = "closed" | "flap" | "rise" | "open";

interface Look {
  stageBg: string;
  stageInk: string;
  stageMuted: string;
  envelope: string;
  envelopeShade: string;
  liner: string;
  linerAccent: string;
  seal: string;
  sealInk: string;
  card: string;
  cardInk: string;
  cardMuted: string;
  cardLine: string;
  accent: string;
  display: string;
  atelier: boolean;
}

function useLook(props: GiftHeroBlockProps, brand: BrandConfig): { look: Look; button: { className: string; style: React.CSSProperties }; css: string; ribbon?: ReturnType<typeof resolveAtelierPalette> } {
  if (props.layout === "atelier") {
    const pal = resolveAtelierPalette(props, brand, "sand");
    return {
      look: {
        stageBg: pal.bg, stageInk: pal.ink, stageMuted: pal.muted,
        envelope: "#F7F1E8", envelopeShade: "#E6D8C6",
        liner: pal.ribbon, linerAccent: pal.ribbonLight,
        seal: pal.ribbon, sealInk: pal.ivory,
        card: pal.ivory, cardInk: pal.ink, cardMuted: pal.muted, cardLine: pal.line,
        accent: pal.ribbon, display: ATELIER_SERIF, atelier: true,
      },
      button: { className: ATELIER_BUTTON_CLASS, style: { background: pal.button, color: pal.onButton } },
      css: ATELIER_CSS,
      ribbon: pal,
    };
  }
  const pal = resolveGiftPalette(props, brand);
  return {
    look: {
      stageBg: pal.bg, stageInk: pal.text, stageMuted: pal.muted,
      envelope: "#F3EADB", envelopeShade: "#DCCBAF",
      liner: pal.gold, linerAccent: "#F3E2B4",
      seal: "#B98E3E", sealInk: "#FBF2DC",
      card: pal.cream, cardInk: pal.creamInk, cardMuted: pal.creamMuted, cardLine: pal.creamLine,
      accent: pal.accent, display: INVITE_DISPLAY, atelier: false,
    },
    button: { className: INVITE_PILL_CLASS, style: pillStyle(pal) },
    css: GIFT_CSS,
  };
}

/** Premium "settle" ease shared by the whole sequence. */
const SETTLE = [0.22, 1, 0.36, 1] as const;

/** Satin liner: a soft sheen across the ribbon colour (no stripes). */
function satin(look: Look, angle: string): string {
  return `linear-gradient(${angle}, ${mixHex(look.liner, "#000000", 0.78)} 0%, ${look.liner} 38%, ${mixHex(look.liner, "#FFFFFF", 0.8)} 52%, ${look.liner} 66%, ${mixHex(look.liner, "#000000", 0.82)} 100%)`;
}

const storageKey = () => {
  try { return `gift-envelope-opened:${window.location.pathname}`; } catch { return ""; }
};

export function GiftEnvelopeIntro({ props, brand, onCtaClick }: { props: GiftHeroBlockProps; brand: BrandConfig; onCtaClick?: () => void }) {
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { look, button, css, ribbon } = useLook(props, brand);
  const { note } = useGiftNoteStore();
  const [phase, setPhase] = useState<Phase>("closed");
  const [flapBehind, setFlapBehind] = useState(false);
  // True once the envelope has finished sinking under the open card (or when a
  // return visit starts open) — then it unmounts.
  const [envelopeGone, setEnvelopeGone] = useState(false);
  const timers = useRef<number[]>([]);

  // Tell the note block it's being shown on the card.
  useEffect(() => {
    setEnvelopeActive(true);
    return () => setEnvelopeActive(false);
  }, []);

  // A return visit in the same tab starts on the open card.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey()) === "1") { setFlapBehind(true); setEnvelopeGone(true); setPhase("open"); }
    } catch { /* storage blocked — start closed */ }
    return () => { for (const t of timers.current) window.clearTimeout(t); };
  }, []);

  const open = () => {
    if (phase !== "closed") return;
    try { sessionStorage.setItem(storageKey(), "1"); } catch { /* ignore */ }
    if (reduced) { setFlapBehind(true); setEnvelopeGone(true); setPhase("open"); return; }
    // One continuous motion: the flap lifts (1.0s), the card starts rising
    // while the flap is still settling, and the full card takes over as the
    // envelope sinks away beneath it.
    setPhase("flap");
    timers.current.push(window.setTimeout(() => setFlapBehind(true), 520));
    timers.current.push(window.setTimeout(() => setPhase("rise"), 700));
    timers.current.push(window.setTimeout(() => setPhase("open"), 1500));
  };

  const goToGifts = (e?: React.MouseEvent) => {
    onCtaClick?.();
    const target = props.ctaUrl && props.ctaUrl.startsWith("#") ? props.ctaUrl.slice(1) : "gifts";
    const el = document.getElementById(target);
    if (el) {
      e?.preventDefault();
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  };

  const logo = look.atelier ? props.logoUrlLight || brand.logoUrl || "" : props.logoUrl || brand.logoUrlDark || brand.logoUrl || "";
  const logoText = props.logoText || brand.brandName || "";
  const initial = (logoText || "·").trim().charAt(0).toUpperCase();
  const to = props.envelopeTo || "For you";
  const front = props.cardFront || "Happy holidays";

  // The card's content: the note when there is one, else the hero copy.
  const card: GiftNoteContent = note && (note.body || note.headline)
    ? note
    : { kicker: props.kicker, headline: props.headline, body: props.subheadline };

  const isOpen = phase === "open";

  return (
    <section
      className="gift-hero gift-envelope relative flex flex-col overflow-hidden"
      data-gift-envelope={phase}
      data-gift-layout={look.atelier ? "atelier" : "classic"}
      style={{ background: look.stageBg, color: look.stageInk, fontFamily: INVITE_BODY, minHeight: "100svh" }}
    >
      <style>{css}{`
        .gift-env-bob { animation: gift-env-bob 2.4s ease-in-out infinite; }
        @keyframes gift-env-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        .gift-env-float { animation: gift-env-float 7s ease-in-out infinite; }
        @keyframes gift-env-float { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-6px) rotate(-0.4deg); } }
        .gift-env-paper { background-image: radial-gradient(rgba(0,0,0,0.035) 0.6px, transparent 0.7px); background-size: 7px 7px; }
        @media (prefers-reduced-motion: reduce) { .gift-env-bob, .gift-env-float { animation: none; } }
      `}</style>
      {!look.atelier && !staticRender && <Snowfall count={Math.max(0, Math.min(60, props.snow ?? 26))} />}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(55% 45% at 50% 55%, ${mixHex(look.liner, look.stageBg, look.atelier ? 0.12 : 0.22)} 0%, transparent 70%)` }} />

      {/* Top bar: just the logo */}
      <div className="relative z-10 flex w-full items-center justify-center px-6 py-5">
        {logo ? <img src={logo} alt={logoText || "Logo"} className="h-6 w-auto" /> : <span className="text-[15px] font-semibold uppercase tracking-[0.42em]">{logoText}</span>}
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-page flex-1 flex-col items-center justify-center px-6 pb-16" style={{ minHeight: "calc(100svh - 72px)" }}>
        {/* Envelope. Stays mounted through "open" so it can sink away under
            the card instead of cutting to it. */}
        <AnimatePresence initial={false}>
          {(phase !== "open" || !envelopeGone) && (
            <motion.div
              key="envelope"
              className={cn("flex w-full flex-col items-center gap-10", isOpen && "pointer-events-none absolute inset-x-0 top-0")}
              animate={isOpen ? { opacity: 0, y: 140, scale: 0.9, filter: "blur(2px)" } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: SETTLE }}
              onAnimationComplete={() => { if (isOpen) setEnvelopeGone(true); }}
            >
              <motion.p
                className="text-[11px] font-semibold uppercase tracking-[0.32em]"
                style={{ color: look.stageMuted }}
                animate={{ opacity: phase === "closed" ? 1 : 0 }}
                transition={{ duration: 0.4 }}
              >
                {props.kicker || "Something for you"}
              </motion.p>
              <div
                role="button"
                tabIndex={0}
                aria-label={props.openCardText || "Open card"}
                onClick={open}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
                className={cn("relative w-[min(560px,88vw)] cursor-pointer", phase === "closed" && "gift-env-float")}
                style={{ aspectRatio: "1.55 / 1", perspective: "1100px", perspectiveOrigin: "50% 100%" }}
                data-gift-envelope-body="true"
              >
                {/* envelope body (back panel) */}
                <div className="absolute inset-0 rounded-[10px]" style={{ background: `linear-gradient(180deg, ${look.envelopeShade} 0%, ${mixHex(look.envelopeShade, "#000000", 0.9)} 100%)`, boxShadow: "0 60px 90px -44px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.25) inset" }} />
                {/* satin liner, seen once the flap is up */}
                <div className="absolute inset-0 rounded-[10px]" style={{ clipPath: "polygon(2.5% 1.5%, 97.5% 1.5%, 50% 55%)", background: satin(look, "180deg") }} />
                <div className="absolute inset-0 rounded-[10px]" style={{ clipPath: "polygon(2.5% 1.5%, 97.5% 1.5%, 50% 55%)", background: "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 45%)" }} />

                {/* the card inside */}
                <motion.div
                  className="absolute inset-x-[6%] top-[5%] bottom-[6%] flex flex-col items-center justify-center gap-2 rounded-[6px] gift-env-paper"
                  style={{ background: look.card, color: look.cardInk, zIndex: 2, boxShadow: `inset 0 0 0 1px ${look.cardLine}` }}
                  animate={phase === "rise" || isOpen ? { y: "-64%", scale: 1.04, boxShadow: `inset 0 0 0 1px ${look.cardLine}, 0 40px 70px -40px rgba(0,0,0,0.6)` } : { y: 0, scale: 1 }}
                  transition={{ duration: 1.05, ease: SETTLE }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: look.cardMuted }}>{props.tagTo || "To you"}</span>
                  <span className="text-center leading-none" style={{ fontFamily: look.display, fontSize: "clamp(1.6rem, 4.4vw, 2.6rem)", letterSpacing: "-0.03em" }}>{front}</span>
                </motion.div>

                {/* front pocket */}
                <div
                  className="absolute inset-0 rounded-[10px] gift-env-paper"
                  style={{
                    zIndex: 3,
                    clipPath: "polygon(0 0, 50% 54%, 100% 0, 100% 100%, 0 100%)",
                    background: `linear-gradient(165deg, ${mixHex(look.envelope, "#FFFFFF", 0.5)} 0%, ${look.envelope} 45%, ${mixHex(look.envelope, look.envelopeShade, 0.55)} 100%)`,
                  }}
                >
                  {/* soft creases where the side flaps meet */}
                  <div className="absolute inset-0" style={{ background: `linear-gradient(to top right, transparent 49.4%, rgba(0,0,0,0.10) 50%, rgba(255,255,255,0.35) 50.5%, transparent 51.2%), linear-gradient(to top left, transparent 49.4%, rgba(0,0,0,0.10) 50%, rgba(255,255,255,0.35) 50.5%, transparent 51.2%)` }} />
                  <span className="absolute inset-x-0 bottom-[14%] text-center" style={{ fontFamily: look.display, fontSize: "clamp(1.1rem, 2.6vw, 1.6rem)", letterSpacing: "-0.02em", color: look.cardInk }} data-gift-envelope-to="true">
                    {to}
                  </span>
                </div>

                {/* flap: paper on the front, satin on the back, lifting over the top edge */}
                <motion.div
                  className="absolute inset-x-0 top-0"
                  style={{ height: "56%", transformOrigin: "50% 0%", transformStyle: "preserve-3d", zIndex: flapBehind ? 1 : 4 }}
                  animate={{ rotateX: phase === "closed" ? 0 : -152 }}
                  transition={{ duration: 1.15, ease: [0.4, 0, 0.1, 1] }}
                >
                  <div className="absolute inset-0 rounded-t-[10px] gift-env-paper" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", background: `linear-gradient(180deg, ${mixHex(look.envelope, "#FFFFFF", 0.35)} 0%, ${look.envelope} 55%, ${mixHex(look.envelope, look.envelopeShade, 0.6)} 100%)`, backfaceVisibility: "hidden" }} />
                  <motion.div
                    className="absolute inset-0"
                    style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", background: "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 100%)", backfaceVisibility: "hidden" }}
                    animate={{ opacity: phase === "closed" ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                  />
                  <div className="absolute inset-0" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", background: satin(look, "0deg"), transform: "rotateX(180deg)", backfaceVisibility: "hidden" }} />
                  <div className="absolute inset-0" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", background: "linear-gradient(0deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 50%)", transform: "rotateX(180deg)", backfaceVisibility: "hidden" }} />
                </motion.div>

                {/* wax seal: lifts with the flap, then melts away */}
                <motion.div
                  className="absolute left-1/2 top-[56%] flex h-[17%] items-center justify-center rounded-full"
                  style={{ zIndex: 5, aspectRatio: "1 / 1", x: "-50%", y: "-50%", background: `radial-gradient(circle at 35% 30%, ${mixHex(look.seal, "#FFFFFF", 0.7)} 0%, ${look.seal} 55%, ${mixHex(look.seal, "#000000", 0.7)} 100%)`, color: look.sealInk, boxShadow: "0 8px 18px -6px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(255,255,255,0.14), inset 0 -2px 4px rgba(0,0,0,0.25)" }}
                  animate={phase === "closed" ? { opacity: 1, scale: 1, y: "-50%" } : { opacity: 0, scale: 0.7, y: "-110%" }}
                  transition={{ duration: 0.45, ease: SETTLE }}
                  aria-hidden="true"
                >
                  <span style={{ fontFamily: look.display, fontSize: "clamp(1rem, 2.6vw, 1.5rem)", lineHeight: 1 }}>{initial}</span>
                </motion.div>
              </div>
              <motion.button
                type="button"
                onClick={open}
                className={button.className}
                style={button.style}
                data-gift-open-card="true"
                disabled={phase !== "closed"}
                animate={{ opacity: phase === "closed" ? 1 : 0, y: phase === "closed" ? 0 : 8 }}
                transition={{ duration: 0.4 }}
              >
                <Gift className="h-4 w-4" aria-hidden />
                {props.openCardText || "Open card"}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The full card rises into place as the envelope sinks away. */}
        {isOpen && (
            <motion.div
              key="card"
              className="relative z-10 flex w-full flex-col items-center gap-10 pt-4"
              initial={reduced || flapBehind === false ? false : { opacity: 0, y: 90, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.0, ease: SETTLE }}
            >
              <article
                data-gift-card="true"
                className={cn("relative w-[min(680px,100%)] rounded-[14px] px-7 py-10 sm:px-14 sm:py-14", look.atelier && "pl-[20%] sm:pl-[19%]")}
                style={{ background: look.card, color: look.cardInk, boxShadow: `0 60px 120px -60px rgba(0,0,0,0.75), 0 0 0 1px ${look.cardLine}` }}
              >
                {look.atelier && ribbon ? (
                  <>
                    <SatinBand palette={ribbon} className="inset-y-0 left-[7%] w-[30px]" />
                    <SatinBow palette={ribbon} className="absolute left-[calc(7%-56px)] top-[-44px] w-[142px]" />
                  </>
                ) : (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-4 rounded-[10px]" style={{ border: `1px solid ${look.liner}`, opacity: 0.7 }} />
                )}
                <div className="relative flex flex-col items-start gap-5">
                  {!look.atelier && (
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full" style={{ background: look.stageBg, color: look.liner }}>
                      <Snowflake className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                  )}
                  {card?.kicker && <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: look.cardMuted }}>{card.kicker}</p>}
                  {card?.headline && (
                    <h1 className="whitespace-pre-line" style={{ fontFamily: look.display, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.02, fontSize: "clamp(2rem, 4.4vw, 3.2rem)" }}>
                      {card.headline}
                    </h1>
                  )}
                  {card?.greeting && <p className="text-[17px] font-medium">{card.greeting}</p>}
                  {card?.body && <p className="max-w-[52ch] whitespace-pre-line text-[16px] leading-[1.7]" style={{ color: look.cardMuted }}>{card.body}</p>}
                  {card?.personalNote && <p className="max-w-[52ch] whitespace-pre-line text-[16px] leading-[1.7]" data-gift-personal-note="true">{card.personalNote}</p>}
                  {(card?.signoff || card?.signature) && (
                    <div className="mt-1 flex flex-col gap-1">
                      {card.signoff && <p className="text-[12px] font-medium uppercase tracking-[0.24em]" style={{ color: look.cardMuted }}>{card.signoff}</p>}
                      {card.signature && <p className="text-[30px] leading-none" style={{ fontFamily: look.display, letterSpacing: "-0.03em" }}>{card.signature}</p>}
                    </div>
                  )}
                  <RepSignoff
                    repTitle={card?.repTitle}
                    repPhotoUrl={card?.repPhotoUrl}
                    signature={card?.signature}
                    calendarText={card?.calendarText}
                    calendarUrl={card?.calendarUrl}
                    ink={look.cardInk}
                    muted={look.cardMuted}
                    line={look.cardLine}
                    accent={look.accent}
                    isEditor={false}
                    className="mt-1"
                  />
                </div>
              </article>
              <div className="flex flex-col items-center gap-3">
                <a href={props.ctaUrl || "#gifts"} onClick={goToGifts} className={button.className} style={button.style} data-gift-choose="true">
                  {props.chooseGiftText || "Choose your gift"}
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </a>
                <ArrowDown className="gift-env-bob h-5 w-5" aria-hidden style={{ color: look.stageMuted }} />
              </div>
            </motion.div>
        )}
      </div>
    </section>
  );
}
