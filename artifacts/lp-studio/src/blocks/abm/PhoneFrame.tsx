import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Shell colour (the device body). Default near-black. */
  shellColor?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A CSS phone mockup (no device PNG): rounded body, thin bezel, a pill-shaped
 * camera island and a home indicator. Whatever is passed as children fills the
 * screen at the device's native 9:19.5 aspect — a portrait screen recording,
 * an app screenshot, or the family's placeholder graphic.
 */
export function PhoneFrame({ children, shellColor = "#161618", className, style }: Props) {
  return (
    <div
      className={cn("abm-phone relative mx-auto w-full max-w-[320px]", className)}
      style={{
        aspectRatio: "9 / 19.2",
        borderRadius: "46px",
        background: shellColor,
        padding: 12,
        boxShadow: "0 40px 80px -36px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 2px 0 rgba(255,255,255,0.08) inset",
        ...style,
      }}
      data-abm-phone
    >
      {/* Side buttons */}
      <span aria-hidden className="absolute -left-[3px] top-[18%] h-10 w-[3px] rounded-l-sm" style={{ background: shellColor }} />
      <span aria-hidden className="absolute -left-[3px] top-[27%] h-14 w-[3px] rounded-l-sm" style={{ background: shellColor }} />
      <span aria-hidden className="absolute -right-[3px] top-[22%] h-20 w-[3px] rounded-r-sm" style={{ background: shellColor }} />

      <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: 36, background: "#FFFFFF" }}>
        {children}
        {/* Camera island + home indicator sit above the screen content */}
        <span aria-hidden className="absolute left-1/2 top-3 h-[26px] w-[92px] -translate-x-1/2 rounded-full" style={{ background: "#0B0B0F" }} />
        <span aria-hidden className="absolute bottom-2 left-1/2 h-[5px] w-[110px] -translate-x-1/2 rounded-full" style={{ background: "rgba(11,11,15,0.55)" }} />
      </div>
    </div>
  );
}
