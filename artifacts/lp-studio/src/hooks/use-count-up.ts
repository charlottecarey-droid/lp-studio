import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 1400, enabled = true): number {
  const [count, setCount] = useState(0);
  const triggered = useRef(false);
  const elRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCount(target);
      return;
    }
    if (triggered.current) return;

    const el = elRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || triggered.current) return;
        triggered.current = true;
        obs.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setCount(Math.round(eased * target));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration, enabled]);

  return count;
}

export function useCountUpRef() {
  return useRef<HTMLSpanElement | null>(null);
}
