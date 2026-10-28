/**
 * Content Hub — "seen" impressions. Observes every `[data-hub-seen=<key>]`
 * element under `root` and beacons ONE `seen` event per asset per page load
 * the first time at least half of it is in view. Cosmetic-free and fail-open:
 * no IntersectionObserver (old browsers, SSR) → no events, nothing else
 * changes. Suppressed in the builder and on preview surfaces by the beacon
 * itself.
 */
import { useEffect, type RefObject } from "react";
import { assetKey, trackHubAsset, type HubAsset, type HubTrackContext } from "./hub-assets";

export function useHubSeen(root: RefObject<HTMLElement | null>, assets: HubAsset[], ctx: HubTrackContext, enabled: boolean): void {
  // Re-observe when the set of rendered assets changes (search filtering,
  // section edits); the seen-set lives on the root element so a re-run never
  // double-counts an asset already reported.
  const keys = assets.map((a) => assetKey(a)).join("|");
  useEffect(() => {
    const el = root.current;
    if (!enabled || !el || typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    const byKey = new Map<string, HubAsset>();
    for (const a of assets) byKey.set(assetKey(a), a);
    const seenStore = el as HTMLElement & { __hubSeen?: Set<string> };
    const seen = (seenStore.__hubSeen ??= new Set<string>());
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const key = (entry.target as HTMLElement).dataset.hubSeen;
          if (!key || seen.has(key)) continue;
          const asset = byKey.get(key);
          if (!asset) continue;
          seen.add(key);
          trackHubAsset(ctx, asset, "seen");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.5 },
    );
    el.querySelectorAll<HTMLElement>("[data-hub-seen]").forEach((node) => {
      const key = node.dataset.hubSeen;
      if (key && !seen.has(key)) io.observe(node);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keys, ctx.pageId, ctx.sessionId, ctx.blockId]);
}
