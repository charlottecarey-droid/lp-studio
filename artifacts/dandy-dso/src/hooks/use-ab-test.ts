import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MicrositeSkinConfig } from "@/lib/microsite-skin-config";

// ── Types ─────────────────────────────────────────────────────────────────────

type ABVariant = "A" | "B";

type ActiveTest = {
  id: string;
  skin_key: string;
  content_block: string;
  variant_a_value: string;
  variant_b_value: string;
  success_metric: string;
  status: string;
};

// ── Content block → skinConfig field mapping ──────────────────────────────────

function applyContentBlock(
  config: MicrositeSkinConfig,
  contentBlock: string,
  value: string
): MicrositeSkinConfig {
  switch (contentBlock) {
    case "hero_headline":
      return { ...config, heroHeadlinePattern: value };
    case "hero_subtext":
      return { ...config, heroSubtext: value };
    case "hero_cta":
      return { ...config, heroCTAText: value };
    case "cta_section":
      return { ...config, finalCTAHeadline: value };
    case "value_prop":
      // Override first challenge card title as the primary value prop
      return {
        ...config,
        challenges: config.challenges?.length
          ? [{ ...config.challenges[0], title: value }, ...config.challenges.slice(1)]
          : config.challenges,
      };
    default:
      // social_proof, layout — not overrideable via text patch, return as-is
      return config;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useABTest(skinKey: string | null, micrositeId: string | null) {
  const [test, setTest] = useState<ActiveTest | null>(null);
  const [variant, setVariant] = useState<ABVariant | null>(null);
  const viewLogged = useRef(false);

  // Fetch active test for this skin
  useEffect(() => {
    if (!skinKey) return;

    // Normalize skin key: "flagship-dark" → "flagship" for matching purposes
    // since A/B tests are set at skin level (flagship covers both light/dark)
    const normalizedSkin = skinKey === "flagship-dark" ? "flagship" : skinKey;

    supabase
      .from("microsite_ab_tests" as any)
      .select("id, skin_key, content_block, variant_a_value, variant_b_value, success_metric, status")
      .eq("skin_key", normalizedSkin)
      .eq("status", "active")
      .limit(1)
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return;
        const activeTest = data[0] as unknown as ActiveTest;
        setTest(activeTest);

        // Assign variant — persist per visitor per test in localStorage
        const storageKey = `ab_variant_${activeTest.id}`;
        const existing = localStorage.getItem(storageKey);
        if (existing === "A" || existing === "B") {
          setVariant(existing as ABVariant);
        } else {
          const assigned: ABVariant = Math.random() < 0.5 ? "A" : "B";
          localStorage.setItem(storageKey, assigned);
          setVariant(assigned);
        }
      });
  }, [skinKey]);

  // Log view event once per page load
  useEffect(() => {
    if (!test || !variant || viewLogged.current) return;
    viewLogged.current = true;

    supabase
      .from("microsite_ab_events" as any)
      .insert({
        test_id: test.id,
        variant,
        event_type: "view",
        microsite_id: micrositeId,
        visitor_id: getVisitorId(),
      })
      .then(() => {});
  }, [test, variant, micrositeId]);

  // Log time on page when visitor leaves
  useEffect(() => {
    if (!test || !variant) return;
    const enteredAt = Date.now();

    return () => {
      const seconds = Math.round((Date.now() - enteredAt) / 1000);
      if (seconds < 3) return; // ignore bounces under 3 seconds
      supabase
        .from("microsite_ab_events" as any)
        .insert({
          test_id: test.id,
          variant,
          event_type: "time_on_page",
          time_on_page_seconds: seconds,
          microsite_id: micrositeId,
          visitor_id: getVisitorId(),
        })
        .then(() => {});
    };
  }, [test, variant, micrositeId]);

  // CTA click logger
  const logCTAClick = useCallback(() => {
    if (!test || !variant) return;
    supabase
      .from("microsite_ab_events" as any)
      .insert({
        test_id: test.id,
        variant,
        event_type: "cta_click",
        microsite_id: micrositeId,
        visitor_id: getVisitorId(),
      })
      .then(() => {});
  }, [test, variant, micrositeId]);

  // Apply variant content override to skinConfig
  const applyVariant = useCallback(
    (config: MicrositeSkinConfig): MicrositeSkinConfig => {
      if (!test || !variant) return config;
      const value = variant === "A" ? test.variant_a_value : test.variant_b_value;
      if (!value) return config;
      return applyContentBlock(config, test.content_block, value);
    },
    [test, variant]
  );

  return { variant, test, logCTAClick, applyVariant };
}

// ── Stable anonymous visitor ID ───────────────────────────────────────────────

function getVisitorId(): string {
  const key = "dandy_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
