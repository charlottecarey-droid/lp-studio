import type { StickyHeaderBlockProps } from "@/lib/block-types";
import { StickyHeroNav } from "@/components/StickyHeroNav";

interface Props {
  props: StickyHeaderBlockProps;
  onCtaClick?: () => void;
}

export function BlockStickyHeader({ props: p, onCtaClick }: Props) {
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
      position={p.position ?? "fixed"}
      invertLogo={p.invertLogo}
      scrollThreshold={p.scrollThreshold ?? 40}
    />
  );
}
