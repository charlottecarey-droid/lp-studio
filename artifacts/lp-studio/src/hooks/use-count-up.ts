import { useEffect, useRef, useState, useCallback } from "react";

export function useCountUp(target: number, duration = 1400, enabled = true): [number, (el: HTMLElement | null) => void] {
  const [count, setCount] = useState(0);
  const triggered = useRef(false);
  const obsRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((el: HTMLElement | null) => {
    if (obsRef.current) {
      obsRef.current.disconnect();
      obsRef.current = null;
    }
    if (!el) return;

    if (!enabled) {
      setCount(target);
      return;
    }

    if (triggered.current) return;

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
    obsRef.current = obs;
  }, [target, duration, enabled]);

  useEffect(() => {
    if (!enabled) setCount(target);
  }, [enabled, target]);

  useEffect(() => {
    return () => { obsRef.current?.disconnect(); };
  }, []);

  return [count, ref];
}
