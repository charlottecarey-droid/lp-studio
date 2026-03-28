import { createContext, useContext } from "react";

export interface PageContextValue {
  pageId?: number;
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
