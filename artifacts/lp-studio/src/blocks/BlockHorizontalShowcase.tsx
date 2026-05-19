import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import type { HorizontalShowcaseBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";
import { InlineEmailCapture } from "@/components/InlineEmailCapture";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { appendEmailToUrl } from "@/lib/append-email";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: HorizontalShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HorizontalShowcaseBlockProps) => void;
  onCtaClick?: (url: string) => void;
  pageId?: number;
  variantId?: number;
}

/**
 * Horizontal Showcase — pinned full-bleed section where vertical scroll
 * drags huge edge-to-edge panels horizontally past the viewer. Each panel
 * is its own visual story (image + copy + optional CTA). Inspired by Apple
 * product pages and Stripe / Linear marketing sites.
 */
export function BlockHorizontalShowcase({ props, brand, onFieldChange, onCtaClick, pageId, variantId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const emailCfg = props.email ?? {};
  const submitMode = emailCfg.submitMode ?? "navigate";

  const handleEmailSubmit = (panelCtaUrl: string | undefined, submittedEmail: string) => {
    if (submitMode === "modal-form" || submitMode === "modal-chilipiper") {
      setModalOpen(true);
      return;
    }
    const target = appendEmailToUrl(panelCtaUrl ?? "#", submittedEmail);
    if (onCtaClick) onCtaClick(target);
    else safeNavigate(target);
  };

  const handlePanelButtonCta = (panelCtaUrl: string | undefined) => {
    // Plain CTA button always navigates directly — modal logic is reserved for
    // the inline email-capture pill (matches the product-hero pattern).
    const target = panelCtaUrl ?? "#";
    if (onCtaClick) onCtaClick(target);
    else safeNavigate(target);
  };

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const panels = props.panels ?? [];
  const count = Math.max(1, panels.length);
  // Pin for `panelHeightVh` of scroll per panel (default 90vh per panel)
  const heightVh = Math.max(200, Math.min(900, (props.panelHeightVh ?? 90) * count + 100));
  const bg = props.bgColor || "#0B0B0F";

  // Track must travel (count - 1) panel widths from right to left.
  // We add a small lead-in so the first panel sits centered before scrolling.
  const x = useTransform(scrollYProgress, [0.05, 0.95], ["0vw", `-${(count - 1) * 100}vw`]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${heightVh}vh`, backgroundColor: bg }}
      className="relative w-full"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col">
        {/* Eyebrow / section title */}
        {(props.eyebrow || props.headline) && (
          <div className="absolute top-0 left-0 right-0 z-20 px-6 md:px-12 py-6 md:py-8 flex items-center justify-between gap-4 pointer-events-none">
            <div className="pointer-events-auto">
              {props.eyebrow && (
                <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1" style={{ fontFamily: BODY }}>
                  <InlineText
                    value={props.eyebrow}
                    onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, eyebrow: v }) : undefined}
                  />
                </p>
              )}
              {props.headline && (
                <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: DISPLAY }}>
                  <InlineText
                    value={props.headline}
                    onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined}
                  />
                </h2>
              )}
            </div>
            {/* Progress dots */}
            <div className="pointer-events-auto flex items-center gap-2">
              {panels.map((_, i) => (
                <ProgressDot key={i} index={i} total={count} scrollYProgress={scrollYProgress} />
              ))}
            </div>
          </div>
        )}

        <motion.div
          style={{ x }}
          className="flex h-full will-change-transform"
        >
          {panels.map((panel, i) => (
            <div
              key={i}
              style={{ backgroundColor: panel.bgColor || "#16161D" }}
              className="relative shrink-0 w-screen h-screen flex items-center"
            >
              {/* Panel image */}
              {panel.imageUrl && (
                <div className="absolute inset-0">
                  <img
                    src={panel.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(${panel.alignment === "right" ? "270deg" : "90deg"}, ${panel.overlayColor || "rgba(0,0,0,0.55)"} 0%, transparent 65%)`,
                    }}
                  />
                </div>
              )}

              {/* Panel content */}
              <div
                className={`relative z-10 max-w-2xl px-8 md:px-20 ${
                  panel.alignment === "right"
                    ? "ml-auto text-right"
                    : panel.alignment === "center"
                    ? "mx-auto text-center"
                    : "text-left"
                }`}
              >
                {panel.tag && (
                  <span
                    className="inline-block text-xs font-bold uppercase tracking-widest mb-4 px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: panel.accentColor || "var(--brand-accent)",
                      color: panel.bgColor || "#0B0B0F",
                    }}
                  >
                    <InlineText
                      value={panel.tag}
                      onUpdate={onFieldChange ? (v) => updatePanel(panels, i, { tag: v }, props, onFieldChange) : undefined}
                    />
                  </span>
                )}
                <h3 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-[0.95] mb-6" style={{ fontFamily: DISPLAY }}>
                  <InlineText
                    value={panel.title}
                    onUpdate={onFieldChange ? (v) => updatePanel(panels, i, { title: v }, props, onFieldChange) : undefined}
                  />
                </h3>
                {panel.body && (
                  <p className="text-lg md:text-xl text-white/80 leading-relaxed mb-8 max-w-xl" style={{ fontFamily: BODY }}>
                    <InlineText
                      value={panel.body}
                      onUpdate={onFieldChange ? (v) => updatePanel(panels, i, { body: v }, props, onFieldChange) : undefined}
                    />
                  </p>
                )}
                {panel.showEmailCapture ? (
                  <div className={panel.alignment === "center" ? "mx-auto" : panel.alignment === "right" ? "ml-auto" : ""} style={{ maxWidth: 460 }}>
                    <InlineEmailCapture
                      email={email}
                      onEmailChange={setEmail}
                      onSubmit={(v) => handleEmailSubmit(panel.ctaUrl, v)}
                      placeholder={panel.emailPlaceholder ?? "Email address"}
                      buttonText={panel.ctaText || "Get started"}
                      buttonBg={panel.accentColor || "var(--brand-accent)"}
                      buttonColor={panel.bgColor || "#0B0B0F"}
                    />
                  </div>
                ) : panel.ctaText ? (
                  <button
                    onClick={() => handlePanelButtonCta(panel.ctaUrl)}
                    style={{
                      backgroundColor: panel.accentColor || "var(--brand-accent)",
                      color: panel.bgColor || "#0B0B0F",
                    }}
                    className="font-bold px-8 py-4 rounded-xl text-base hover:brightness-110 transition-all"
                  >
                    <InlineText
                      value={panel.ctaText}
                      onUpdate={onFieldChange ? (v) => updatePanel(panels, i, { ctaText: v }, props, onFieldChange) : undefined}
                    />
                  </button>
                ) : null}

                {/* Panel index */}
                <div className="absolute -top-16 left-8 md:left-20 text-7xl md:text-9xl font-black text-white/5 leading-none select-none pointer-events-none">
                  {String(i + 1).padStart(2, "0")}
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

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
        source="horizontal-showcase"
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

function updatePanel(
  panels: HorizontalShowcaseBlockProps["panels"],
  i: number,
  patch: Partial<HorizontalShowcaseBlockProps["panels"][number]>,
  props: HorizontalShowcaseBlockProps,
  onFieldChange: (next: HorizontalShowcaseBlockProps) => void,
) {
  onFieldChange({ ...props, panels: panels.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
}

function ProgressDot({
  index,
  total,
  scrollYProgress,
}: {
  index: number;
  total: number;
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  // Each dot lights up while its panel is the dominant one on screen.
  const start = (index / total) * 0.95;
  const end = ((index + 1) / total) * 0.95;
  const opacity = useTransform(scrollYProgress, [start - 0.02, start, end, end + 0.02], [0.3, 1, 1, 0.3]);
  const width = useTransform(scrollYProgress, [start - 0.02, start, end, end + 0.02], [8, 28, 28, 8]);
  return (
    <motion.div
      style={{ opacity, width, height: 8 }}
      className="rounded-full bg-white"
    />
  );
}
