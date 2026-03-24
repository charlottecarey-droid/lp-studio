import { useEffect, useRef, useState } from "react";

export function useCountUp(
  target: number,
  duration = 1400,
  enabled = true
): [number, React.RefCallback<HTMLElement>] {
  const [count, setCount] = useState(enabled ? 0 : target);
  const triggered = useRef(false);
  const obsRef = useRef<IntersectionObserver | null>(null);

  const refCallback: React.RefCallback<HTMLElement> = (el) => {
    if (obsRef.current) {
      obsRef.current.disconnect();
      obsRef.current = null;
    }
    if (!el || !enabled) return;

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
  };

  useEffect(() => {
    return () => {
      obsRef.current?.disconnect();
    };
  }, []);

  return [count, refCallback];
}
