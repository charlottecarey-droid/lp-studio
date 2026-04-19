import type { StickyHeaderBlockProps } from "@/lib/block-types";
import { StickyHeroNav } from "@/components/StickyHeroNav";

interface Props {
  props: StickyHeaderBlockProps;
  onCtaClick?: () => void;
  /** When true (builder canvas), render in a contained variant so the header
   *  doesn't overlay the builder's top bar / control rails. */
  isBuilder?: boolean;
}

export function BlockStickyHeader({ props: p, onCtaClick, isBuilder }: Props) {
  return (
    <StickyHeroNav
      logoUrl={p.logoUrl}
      logoAlt={p.logoAlt || "Logo"}
      companyName={p.companyName}
      navLinks={p.navLinks}
      primaryCtaText={p.primaryCtaText}
      primaryCtaUrl={p.primaryCtaUrl}
      onPrimaryCtaClick={onCtaClick}
      theme={p.theme ?? "dark"}
      accentColor={p.accentColor}
      position={isBuilder ? "absolute" : (p.position ?? "fixed")}
      invertLogo={p.invertLogo}
      scrollThreshold={p.scrollThreshold ?? 40}
    />
  );
}
