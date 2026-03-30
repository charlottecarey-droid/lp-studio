import { useEffect, useRef, useCallback } from "react";

/**
 * Lightweight click & scroll collector for landing pages.
 * Batches events and flushes every 3 seconds or on page unload.
 * Coordinates are stored as percentages of the full document so
 * heatmaps render correctly across responsive breakpoints.
 */

interface HeatmapEvent {
  pageId: number;
  sessionId: string;
  eventType: "click" | "scroll";
  xPct?: number;
  yPct?: number;
  blockId?: string;
  elementTag?: string;
  scrollDepthPct?: number;
  viewportWidth: number;
  viewportHeight: number;
  device: "desktop" | "tablet" | "mobile";
}

function detectDevice(): "desktop" | "tablet" | "mobile" {
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function findBlockId(el: HTMLElement): string | undefined {
  let node: HTMLElement | null = el;
  while (node) {
    const bid = node.getAttribute("data-block-id");
    if (bid) return bid;
    node = node.parentElement;
  }
  return undefined;
}

const FLUSH_INTERVAL = 3000;
const API_BASE = "/api";

export function useHeatmapTracker(pageId: number | undefined | null, sessionId: string | undefined | null, enabled = true) {
  const buffer = useRef<HeatmapEvent[]>([]);
  const maxScrollDepth = useRef(0);
  const lastScrollFlush = useRef(0);

  const flush = useCallback(() => {
    if (buffer.current.length === 0) return;
    const events = buffer.current.splice(0);
    // Use sendBeacon for reliability on page unload, fall back to fetch
    const payload = JSON.stringify({ events });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API_BASE}/lp/heatmap`, payload);
    } else {
      fetch(`${API_BASE}/lp/heatmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!enabled || !pageId || !sessionId) return;

    const device = detectDevice();

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const docHeight = document.documentElement.scrollHeight;
      const pageY = e.pageY; // absolute Y from top of document
      buffer.current.push({
        pageId: pageId!,
        sessionId: sessionId!,
        eventType: "click",
        xPct: Math.round((e.pageX / document.documentElement.scrollWidth) * 10000) / 100,
        yPct: Math.round((pageY / docHeight) * 10000) / 100,
        blockId: findBlockId(target),
        elementTag: target.tagName.toLowerCase(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        device,
      });
    };

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const depth = Math.min(Math.round((scrollTop / docHeight) * 10000) / 100, 100);
      if (depth > maxScrollDepth.current) {
        maxScrollDepth.current = depth;
      }
      // Throttle scroll events — only push to buffer every 2 seconds
      const now = Date.now();
      if (now - lastScrollFlush.current > 2000) {
        lastScrollFlush.current = now;
        buffer.current.push({
          pageId: pageId!,
          sessionId: sessionId!,
          eventType: "scroll",
          scrollDepthPct: maxScrollDepth.current,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          device,
        });
      }
    };

    document.addEventListener("click", handleClick, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    const interval = setInterval(flush, FLUSH_INTERVAL);

    // Flush on page hide / unload
    const handleUnload = () => {
      // Push final scroll depth
      if (maxScrollDepth.current > 0) {
        buffer.current.push({
          pageId: pageId!,
          sessionId: sessionId!,
          eventType: "scroll",
          scrollDepthPct: maxScrollDepth.current,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          device,
        });
      }
      flush();
    };
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll);
      clearInterval(interval);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      flush();
    };
  }, [pageId, sessionId, enabled, flush]);
}
