import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type AppMode = "marketing" | "sales";

const STORAGE_KEY = "lp-studio-mode";

export function getSavedMode(): AppMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "sales" ? "sales" : "marketing";
  } catch {
    return "marketing";
  }
}

function getRoleLockedMode(role: string | undefined): AppMode | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r === "sales") return "sales";
  if (r === "marketing") return "marketing";
  return null;
}

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  lockedMode: AppMode | null;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

export function ModeProvider({ children, userRole }: { children: ReactNode; userRole?: string }) {
  const lockedMode = getRoleLockedMode(userRole);
  const [mode, setModeState] = useState<AppMode>(() => lockedMode ?? getSavedMode());

  useEffect(() => {
    if (lockedMode && lockedMode !== mode) {
      setModeState(lockedMode);
    }
  }, [lockedMode]);

  const setMode = useCallback((m: AppMode) => {
    if (lockedMode) return;
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch {}
  }, [lockedMode]);

  const toggleMode = useCallback(() => {
    if (lockedMode) return;
    setMode(mode === "marketing" ? "sales" : "marketing");
  }, [mode, setMode, lockedMode]);

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode, lockedMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useAppMode must be used within ModeProvider");
  return ctx;
}
