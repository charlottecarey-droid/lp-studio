import type { StickyHeaderBlockProps } from "@/lib/block-types";
import { StickyHeroNav } from "@/components/StickyHeroNav";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: StickyHeaderBlockProps;
  brand?: BrandConfig;
  onCtaClick?: () => void;
  /** When true (builder canvas), render in a contained variant so the header
   *  doesn't overlay the builder's top bar / control rails. */
  isBuilder?: boolean;
}

export function BlockStickyHeader({ props: p, brand, onCtaClick, isBuilder }: Props) {
  return (
    <StickyHeroNav
      brand={brand}
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
