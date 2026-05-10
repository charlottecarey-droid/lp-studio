import { createContext, useContext, type ReactNode } from "react";
import type { LinkedFormStyle } from "@/lib/linked-form-style";

const LinkedFormStyleContext = createContext<LinkedFormStyle | null>(null);

export function LinkedFormStyleProvider({
  value,
  children,
}: {
  value: LinkedFormStyle | null;
  children: ReactNode;
}) {
  return (
    <LinkedFormStyleContext.Provider value={value}>{children}</LinkedFormStyleContext.Provider>
  );
}

/** Returns the page-level linked-form style overrides, or null when none configured. */
export function useLinkedFormStyle(): LinkedFormStyle | null {
  return useContext(LinkedFormStyleContext);
}
