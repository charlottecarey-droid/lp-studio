import type { IdMarqueeBlockProps } from "@/lib/block-types";
import { BRAND_BODY_FONT } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { renderEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdMarqueeBlockProps;
  onFieldChange?: (next: IdMarqueeBlockProps) => void;
}

export function BlockIdMarquee({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const items = props.items ?? [];
  const isEditor = !!onFieldChange;
  const updateItem = (i: number, v: string) => {
    if (!onFieldChange) return;
    const next = [...items];
    next[i] = v;
    onFieldChange({ ...props, items: next });
  };

  // In editor mode: render items once with animation paused so InlineText
  // never loses focus due to scrolling. In preview mode: render twice for
  // seamless infinite loop driven by the CSS keyframe `idMarquee`.
  const trackStyle: React.CSSProperties = {
    animationDuration: `${props.durationSec ?? 40}s`,
    ...(isEditor ? { animationPlayState: "paused", transform: "none" } : {}),
  };

  return (
    <div className="id-block id-marquee" aria-hidden={!isEditor}>
      <div className="id-track" style={trackStyle}>
        {(isEditor ? [0] : [0, 1]).map((pass) => (
          <div key={pass} style={{ display: "inline-flex", alignItems: "center", gap: 80 }}>
            {items.map((item, i) => (
              <span key={`${pass}-${i}`} className="id-item" style={{ fontFamily: BODY }}>
                {isEditor && pass === 0 ? (
                  <InlineText as="span" value={item} onUpdate={(v) => updateItem(i, v)} style={{ fontFamily: BODY }}/>
                ) : (
                  renderEm(item)
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
