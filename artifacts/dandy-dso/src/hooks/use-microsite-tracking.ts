import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type TrackingContext = {
  micrositeId: string;
  slug: string;
};

/**
 * Tracks scroll depth per section and CTA clicks for a microsite.
 * - Scroll: fires once per section when ≥50% visible
 * - CTA: call trackCTA(label) on button click
 */
export function useMicrositeTracking(ctx: TrackingContext | null) {
  const trackedSections = useRef<Set<string>>(new Set());
  const queueRef = useRef<Array<{ event_type: string; event_data: any }>>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Batch-flush events every 2s to reduce DB calls
  const flush = useCallback(() => {
    if (!ctx || queueRef.current.length === 0) return;
    const batch = [...queueRef.current];
    queueRef.current = [];
    // Insert all queued events
    const rows = batch.map((e) => ({
      microsite_id: ctx.micrositeId,
      slug: ctx.slug,
      event_type: e.event_type,
      event_data: e.event_data,
    }));
    supabase.from("microsite_events" as any).insert(rows).then(() => {});
  }, [ctx]);

  const enqueue = useCallback(
    (event_type: string, event_data: any) => {
      queueRef.current.push({ event_type, event_data });
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, 2000);
    },
    [flush]
  );

  // On hotlink visit, update clicked_at on matching outreach log
  useEffect(() => {
    if (!ctx) return;
    const params = new URLSearchParams(window.location.search);
    const hlToken = params.get("hl");
    if (!hlToken) return;

    (async () => {
      // Find the hotlink ID from the token
      const { data: hlData } = await supabase
        .from("microsite_hotlinks")
        .select("id")
        .eq("token", hlToken)
        .limit(1);

      if (hlData && hlData.length > 0) {
        const hotlinkId = hlData[0].id;
        // Update first outreach log with this hotlink that hasn't been clicked yet
        await supabase
          .from("email_outreach_log" as any)
          .update({ clicked_at: new Date().toISOString() })
          .eq("hotlink_id", hotlinkId)
          .is("clicked_at", null);
      }
    })();
  }, [ctx]);

  // Scroll depth observer
  useEffect(() => {
    if (!ctx) return;

    const sectionIds = [
      "hero", "platform", "solutions", "results", "calculator",
      "comparison", "lab-tour", "cta", "dashboard", "resources",
      "hidden-costs", "pilot", "activation"
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !trackedSections.current.has(entry.target.id)) {
            trackedSections.current.add(entry.target.id);
            enqueue("scroll_depth", { section: entry.target.id });
          }
        }
      },
      { threshold: 0.5 }
    );

    // Observe after a short delay so sections render
    const timer = setTimeout(() => {
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      // Flush remaining events on unmount
      flush();
    };
  }, [ctx, enqueue, flush]);

  // CTA click tracker
  const trackCTA = useCallback(
    (label: string) => {
      if (!ctx) return;
      enqueue("cta_click", { label });
      // Flush immediately for CTA clicks (high-value event)
      flush();
    },
    [ctx, enqueue, flush]
  );

  // Global button/link click tracker
  useEffect(() => {
    if (!ctx) return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("button, a, [role='button']") as HTMLElement | null;
      if (!target) return;

      const label =
        target.getAttribute("aria-label") ||
        target.textContent?.trim().slice(0, 80) ||
        target.tagName;

      const href = (target as HTMLAnchorElement).href || undefined;

      enqueue("button_click", {
        label,
        tag: target.tagName.toLowerCase(),
        href,
        section: target.closest("[id]")?.id || null,
      });
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [ctx, enqueue]);

  return { trackCTA };
}
