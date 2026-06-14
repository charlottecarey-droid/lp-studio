import { createContext, useContext } from "react";
import type { CtaConfig } from "@/lib/cta/ctaConfig";

export interface PageContextValue {
  pageId?: number;
  /**
   * Active A/B test id when the page is being rendered as a test variant.
   * Plumbed through so descendant blocks (forms, Chili Piper handoff, etc.)
   * can attribute conversions correctly. Undefined on plain builder pages.
   */
  testId?: number;
  variantId?: number;
  sessionId?: string;
  /**
   * Unified CTA architecture (Phase 1). The page-level default CTA + the live
   * tenant-default CTA, threaded so the shared renderer (CtaButton) can resolve
   * a block's EFFECTIVE CTA as tenant default → page CTA → block override. Both
   * optional/undefined on pages that predate the feature, so the resolver falls
   * back to the block's own props exactly as before.
   */
  pageCta?: CtaConfig | null;
  tenantDefaultCta?: CtaConfig | null;
}

const PageContext = createContext<PageContextValue>({});

export function PageContextProvider({
  value,
  children,
}: {
  value: PageContextValue;
  children: React.ReactNode;
}) {
  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

export function usePageContext(): PageContextValue {
  return useContext(PageContext);
}
