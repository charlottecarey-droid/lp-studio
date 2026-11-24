import { useEffect, useRef, useState } from "react";
import type { PageBlock } from "@/lib/block-types";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { getBrandStyleVars } from "@/lib/brand-config";
import { useBrandConfig } from "@/context/BrandConfigContext";

const FRAME_W = 1280;
const FRAME_H = 720;

/** {{first_name|you}} → "you", {{rep_name}} → "" so a preview never shows raw tokens. */
export function resolvePreviewTokens<T>(value: T): T {
  const text = JSON.stringify(value).replace(/\{\{\s*[^{}|]+?\s*(?:\|([^{}]*?))?\}\}/g, (_m, fb) => String(fb ?? "").replace(/"/g, '\\"'));
  return JSON.parse(text) as T;
}

/**
 * A live, non-interactive thumbnail of a gift page's hero: the real block
 * rendered at desktop width and scaled down to the card. The envelope intro is
 * forced off so the preview never covers itself.
 */
export function GiftPagePreview({ heroProps, className = "" }: { heroProps: Record<string, unknown> | undefined; className?: string }) {
  const { brand } = useBrandConfig();
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / FRAME_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!heroProps) return <div className={`aspect-video rounded-lg bg-muted ${className}`} />;
  const block = { id: "gift-preview", type: "gift-hero", props: resolvePreviewTokens({ ...heroProps, envelopeIntro: false, minHeightVh: 60 }) } as unknown as PageBlock;
  return (
    <div ref={wrap} className={`relative aspect-video overflow-hidden rounded-lg border bg-muted ${className}`} aria-hidden="true">
      <div className="pointer-events-none absolute left-0 top-0 origin-top-left select-none" style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})`, ...getBrandStyleVars(brand) }}>
        <BlockRenderer block={block} brand={brand} animationsEnabled={false} />
      </div>
    </div>
  );
}
