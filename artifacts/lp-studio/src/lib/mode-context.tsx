import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type AppMode = "marketing" | "sales";

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    try {
      const saved = window.sessionStorage.getItem("lp-studio-mode");
      return saved === "sales" ? "sales" : "marketing";
    } catch {
      return "marketing";
    }
  });

  const setMode = useCallback((m: AppMode) => {
    setModeState(m);
    try { window.sessionStorage.setItem("lp-studio-mode", m); } catch {}
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "marketing" ? "sales" : "marketing");
  }, [mode, setMode]);

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useAppMode must be used within ModeProvider");
  return ctx;
}
