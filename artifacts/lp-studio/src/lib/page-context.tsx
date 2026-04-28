import { createContext, useContext } from "react";

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
