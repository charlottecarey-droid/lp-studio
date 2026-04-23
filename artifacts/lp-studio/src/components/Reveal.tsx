import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

export type RevealDirection = "up" | "down" | "left" | "right" | "scale" | "fade";

interface Props {
  children: ReactNode;
  /** Direction the content travels in from. `up` is the default — content
   *  starts 24px below and slides up while fading in. */
  direction?: RevealDirection;
  /** Delay (seconds) before the reveal starts. Lets you stagger sibling reveals. */
  delay?: number;
  /** Animation duration in seconds. */
  duration?: number;
  /** How much of the element must be in view before triggering. 0..1. */
  amount?: number;
  /** Pixel distance the content travels for `up`/`down`/`left`/`right`. */
  distance?: number;
  /** When true (default) the reveal only fires once. */
  once?: boolean;
  /** Disables the animation entirely — child renders inline. */
  disabled?: boolean;
  className?: string;
}

const variantsFor = (direction: RevealDirection, distance: number) => {
  switch (direction) {
    case "down":   return { hidden: { opacity: 0, y: -distance },           visible: { opacity: 1, y: 0 } };
    case "left":   return { hidden: { opacity: 0, x: distance },            visible: { opacity: 1, x: 0 } };
    case "right":  return { hidden: { opacity: 0, x: -distance },           visible: { opacity: 1, x: 0 } };
    case "scale":  return { hidden: { opacity: 0, scale: 0.92 },            visible: { opacity: 1, scale: 1 } };
    case "fade":   return { hidden: { opacity: 0 },                         visible: { opacity: 1 } };
    case "up":
    default:       return { hidden: { opacity: 0, y: distance },            visible: { opacity: 1, y: 0 } };
  }
};

/**
 * Reveal — fades + slides children in when they enter the viewport.
 *
 * Used by `BlockRenderer` to give every page a polished, deliberate feel
 * as the user scrolls. Honors the `animationsEnabled` flag from the
 * builder so previews stay snappy. Honors `prefers-reduced-motion` via
 * Framer Motion's MotionConfig (handled at app root).
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.55,
  amount = 0.18,
  distance = 28,
  once = true,
  disabled = false,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount, once });

  if (disabled) {
    return <div ref={ref} className={className}>{children}</div>;
  }

  const variants = variantsFor(direction, distance);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}
