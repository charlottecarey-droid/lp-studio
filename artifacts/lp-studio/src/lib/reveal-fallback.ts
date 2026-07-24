/**
 * Fail-open guards for scroll-reveal animations.
 *
 * Blocks and the shared Reveal/ScrollReveal wrappers start content at
 * `opacity: 0` and reveal it when an IntersectionObserver fires. That
 * observer is NOT guaranteed to fire: template-library previews render
 * inside scaled/offscreen iframes, thumbnails are captured at t=0, and a
 * tall section can never satisfy a fixed `amount` threshold in a short
 * viewport — in all of those the content stayed invisible or
 * semi-transparent forever (July 2026: transparent hero text in the
 * template library, faded stat text on published web one-pagers).
 *
 * Two guards fix the class of bug:
 *  - StaticRenderContext: contexts that want the FINAL frame (template
 *    preview, thumbnail capture, builder canvas) opt out of entrance
 *    animations entirely, making the builder true-WYSIWYG.
 *  - useRevealFallback: everywhere else, a watchdog reveals the content
 *    anyway if the observer hasn't fired shortly after mount. Animation is
 *    an enhancement; visibility is the contract.
 */
import { createContext, useContext, useEffect, useState } from "react";
import type { TargetAndTransition } from "framer-motion";

export const StaticRenderContext = createContext(false);

/** True when this tree renders as a static snapshot — render reveals in
 *  their final (visible) state, no entrance animation. */
export function useStaticRender(): boolean {
  return useContext(StaticRenderContext);
}

/**
 * For blocks whose elements animate via framer `initial`/`animate`/
 * `whileInView` props: returns a wrapper for the `initial` value that
 * becomes `false` (render final state, no entrance animation) under a
 * static render. Usage: `const anim = useAnimInitial();` then
 * `initial={anim({ opacity: 0, y: 10 })}`.
 */
export function useAnimInitial(): (from: TargetAndTransition) => TargetAndTransition | false {
  const staticRender = useStaticRender();
  return (from: TargetAndTransition) => (staticRender ? false : from);
}

/**
 * Watchdog for observer-driven reveals: returns true once the content must
 * be shown regardless of the IntersectionObserver — immediately under a
 * static render, or `timeoutMs` after mount when the observer never fired.
 */
export function useRevealFallback(inView: boolean, timeoutMs = 2200): boolean {
  const staticRender = useStaticRender();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (inView || timedOut) return;
    const t = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [inView, timedOut, timeoutMs]);
  return staticRender || timedOut;
}
