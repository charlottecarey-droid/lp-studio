import { useRef, useState } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import type { StickyStackBlockProps, StickyStackCard } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";
import { InlineEmailCapture } from "@/components/InlineEmailCapture";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { appendEmailToUrl } from "@/lib/append-email";

interface Props {
  props: StickyStackBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: StickyStackBlockProps) => void;
  onCtaClick?: (url: string) => void;
  pageId?: number;
  variantId?: number;
}

/**
 * Sticky Stack — giant cards that stack on top of each other as you scroll.
 * Each card pins to the viewport, then scales down + recedes into the back
 * as the next card slides up over it. Inspired by Apple's iPhone feature
 * pages and Linear's "Built for product teams" section.
 */
export function BlockStickyStack({ props, brand, onFieldChange, onCtaClick, pageId, variantId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const emailCfg = props.email ?? {};
  const submitMode = emailCfg.submitMode ?? "navigate";

  const handleEmailSubmit = (cardCtaUrl: string | undefined, submittedEmail: string) => {
    if (submitMode === "modal-form" || submitMode === "modal-chilipiper") {
      setModalOpen(true);
      return;
    }
    const target = appendEmailToUrl(cardCtaUrl ?? "#", submittedEmail);
    if (onCtaClick) onCtaClick(target);
    else safeNavigate(target);
  };

  const handleCardButtonCta = (cardCtaUrl: string | undefined) => {
    // Plain CTA button always navigates directly — modal logic is reserved for
    // the inline email-capture pill (matches the product-hero pattern).
    const target = cardCtaUrl ?? "#";
    if (onCtaClick) onCtaClick(target);
    else safeNavigate(target);
  };

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const cards = props.cards ?? [];
  const count = Math.max(1, cards.length);
  // Each card gets one screen-height of scroll to play out, plus a final dwell.
  const heightVh = (props.cardScrollVh ?? 110) * count + 50;

  return (
    <div
      ref={containerRef}
      style={{ height: `${heightVh}vh`, backgroundColor: props.bgColor || "#FAFAF7" }}
      className="relative w-full"
    >
      {props.eyebrow || props.headline ? (
        <div className="sticky top-0 z-0 pt-16 md:pt-24 px-6 md:px-12 text-center pointer-events-none">
          {props.eyebrow && (
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-primary)] mb-2 pointer-events-auto">
              <InlineText
                value={props.eyebrow}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, eyebrow: v }) : undefined}
              />
            </p>
          )}
          {props.headline && (
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 max-w-3xl mx-auto pointer-events-auto">
              <InlineText
                value={props.headline}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined}
              />
            </h2>
          )}
        </div>
      ) : null}

      {cards.map((card, i) => (
        <CardLayer
          key={i}
          index={i}
          total={count}
          card={card}
          email={email}
          onEmailChange={setEmail}
          onEmailSubmit={(v) => handleEmailSubmit(card.ctaUrl, v)}
          onButtonCta={() => handleCardButtonCta(card.ctaUrl)}
          scrollYProgress={scrollYProgress}
          onChange={onFieldChange ? (patch) => onFieldChange({
            ...props,
            cards: cards.map((c, idx) => idx === i ? { ...c, ...patch } : c),
          }) : undefined}
        />
      ))}

      <EmailCaptureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        email={email}
        mode={submitMode === "modal-chilipiper" ? "chilipiper" : "form"}
        chilipiperUrl={emailCfg.modalChilipiperUrl}
        primaryColor={brand.primaryColor}
        accentColor={brand.accentColor}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source="sticky-stack"
        formSource={emailCfg.modalFormSource ?? "simple"}
        linkedFormId={emailCfg.modalFormId}
        marketoBaseUrl={emailCfg.modalMarketoBaseUrl}
        marketoMunchkinId={emailCfg.modalMarketoMunchkinId}
        marketoFormId={emailCfg.modalMarketoFormId}
        formConfig={{
          headline: emailCfg.modalHeadline,
          subheadline: emailCfg.modalSubheadline,
          submitText: emailCfg.modalSubmitText,
          successMessage: emailCfg.modalSuccessMessage,
          disclaimer: emailCfg.modalDisclaimer,
          showFirstName: emailCfg.modalShowFirstName,
          showLastName: emailCfg.modalShowLastName,
          showPhone: emailCfg.modalShowPhone,
          showCompany: emailCfg.modalShowCompany,
        }}
      />
    </div>
  );
}

function CardLayer({
  index,
  total,
  card,
  email,
  onEmailChange,
  onEmailSubmit,
  onButtonCta,
  scrollYProgress,
  onChange,
}: {
  index: number;
  total: number;
  card: StickyStackCard;
  email: string;
  onEmailChange: (v: string) => void;
  onEmailSubmit: (v: string) => void;
  onButtonCta: () => void;
  scrollYProgress: MotionValue<number>;
  onChange?: (patch: Partial<StickyStackCard>) => void;
}) {
  const slice = 1 / total;
  const start = index * slice;
  const end = (index + 1) * slice;

  // Each card scales down and recedes once the next card starts coming in.
  // The very last card just sits there.
  const isLast = index === total - 1;
  const recedeAt = isLast ? 1 : end;

  const scale = useTransform(scrollYProgress, [start, recedeAt], [1, isLast ? 1 : 0.92]);
  const y = useTransform(scrollYProgress, [start, recedeAt], [0, isLast ? 0 : -40]);
  const opacity = useTransform(scrollYProgress, [start, recedeAt - 0.02, recedeAt], [1, 1, isLast ? 1 : 0.6]);

  // Stagger top so each subsequent card sits a tiny bit lower on the stack
  // — gives a deck-of-cards feel when one is receding.
  const topOffset = `calc(8vh + ${index * 18}px)`;

  return (
    <div
      className="sticky w-full px-4 md:px-8"
      style={{ top: topOffset, height: "84vh" }}
    >
      <motion.div
        style={{
          scale,
          y,
          opacity,
          backgroundColor: card.bgColor || "#0B0B0F",
          color: card.textColor || "#fff",
          zIndex: 10 + index,
        }}
        className="relative w-full h-full max-w-7xl mx-auto rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-2"
      >
        {/* Image side */}
        {card.imageUrl ? (
          <div
            className={`relative h-64 md:h-full ${card.imageSide === "left" ? "md:order-1" : "md:order-2"}`}
          >
            <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div
            className={`relative h-64 md:h-full ${card.imageSide === "left" ? "md:order-1" : "md:order-2"} flex items-center justify-center`}
            style={{ backgroundColor: card.accentColor || "var(--brand-accent)" }}
          >
            <span className="text-9xl md:text-[14rem] font-black opacity-20" style={{ color: card.bgColor || "#0B0B0F" }}>
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
        )}

        {/* Copy side */}
        <div className={`flex flex-col justify-center p-8 md:p-16 ${card.imageSide === "left" ? "md:order-2" : "md:order-1"}`}>
          {card.tag && (
            <span
              className="self-start text-xs font-bold uppercase tracking-widest mb-5 px-3 py-1 rounded-full"
              style={{
                backgroundColor: card.accentColor || "var(--brand-accent)",
                color: card.bgColor || "#0B0B0F",
              }}
            >
              <InlineText value={card.tag} onUpdate={onChange ? (v) => onChange({ tag: v }) : undefined} />
            </span>
          )}
          <h3 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
            <InlineText value={card.title} onUpdate={onChange ? (v) => onChange({ title: v }) : undefined} />
          </h3>
          {card.body && (
            <p className="text-base md:text-lg leading-relaxed opacity-80 max-w-md">
              <InlineText value={card.body} onUpdate={onChange ? (v) => onChange({ body: v }) : undefined} />
            </p>
          )}

          {card.showEmailCapture ? (
            <div className="mt-7 max-w-md">
              <InlineEmailCapture
                email={email}
                onEmailChange={onEmailChange}
                onSubmit={onEmailSubmit}
                placeholder={card.emailPlaceholder ?? "Email address"}
                buttonText={card.ctaText || "Get started"}
                buttonBg={card.accentColor || "var(--brand-accent)"}
                buttonColor={card.bgColor || "#0B0B0F"}
              />
            </div>
          ) : card.ctaText ? (
            <button
              onClick={onButtonCta}
              style={{
                backgroundColor: card.accentColor || "var(--brand-accent)",
                color: card.bgColor || "#0B0B0F",
              }}
              className="self-start mt-7 font-bold px-7 py-3.5 rounded-xl text-sm md:text-base hover:brightness-110 transition-all"
            >
              <InlineText value={card.ctaText} onUpdate={onChange ? (v) => onChange({ ctaText: v }) : undefined} />
            </button>
          ) : null}

          {/* Big card number, faint background */}
          <div className="absolute bottom-6 right-8 text-7xl md:text-9xl font-black opacity-10 leading-none select-none pointer-events-none">
            {String(index + 1).padStart(2, "0")}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
