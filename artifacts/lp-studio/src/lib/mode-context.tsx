import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type AppMode = "marketing" | "sales";

const STORAGE_KEY = "lp-studio-mode";

export function getSavedMode(): AppMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "sales" ? "sales" : "marketing";
  } catch {
    return "marketing";
  }
}

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(getSavedMode);

  const setMode = useCallback((m: AppMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch {}
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
