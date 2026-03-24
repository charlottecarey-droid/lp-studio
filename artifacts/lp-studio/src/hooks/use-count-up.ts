import { useEffect, useRef, useState, useCallback } from "react";

export function useCountUp(
  target: number,
  duration = 1400,
  enabled = true
): [number, React.RefCallback<HTMLElement>] {
  const [count, setCount] = useState(enabled ? 0 : target);
  const triggered = useRef(false);
  const obsRef = useRef<IntersectionObserver | null>(null);
  const elRef = useRef<HTMLElement | null>(null);

  const attach = useCallback(() => {
    if (obsRef.current) {
      obsRef.current.disconnect();
      obsRef.current = null;
    }
    const el = elRef.current;
    if (!el || !enabled || triggered.current) return;

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

  const refCallback: React.RefCallback<HTMLElement> = useCallback(
    (el) => {
      elRef.current = el;
      attach();
    },
    [attach]
  );

  useEffect(() => {
    if (!enabled) {
      setCount(target);
      triggered.current = false;
    }
    attach();
    return () => { obsRef.current?.disconnect(); };
  }, [enabled, attach, target]);

  return [count, refCallback];
}
