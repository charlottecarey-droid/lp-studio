import { useEffect, useRef, useState } from "react";

export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // IntersectionObserver thresholds are a fraction of the TARGET's height.
    // For a target much taller than the viewport (e.g. /pricing with the
    // feature map open — thousands of px), a fixed 12% can exceed what any
    // viewport can show at once, so the observer never fires and the section
    // stays stuck at opacity 0. Cap the effective threshold so half a
    // viewport's worth of the element is always enough; normal-sized
    // sections keep the 12% feel.
    const targetH = el.offsetHeight || 1;
    const viewportH = window.innerHeight || 800;
    const effectiveThreshold = Math.min(threshold, (viewportH * 0.5) / targetH);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: effectiveThreshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}
