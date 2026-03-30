import { useAppMode, type AppMode } from "@/lib/mode-context";
import { useLocation } from "wouter";
import { Megaphone, Target } from "lucide-react";

export function ModeToggle() {
  const { setMode } = useAppMode();
  const [location, navigate] = useLocation();

  // Derive active mode from the URL — single source of truth so the
  // toggle is always in sync regardless of how the user navigated here.
  const isSales = location === "/sales" || location.startsWith("/sales/");

  function handleSwitch(newMode: AppMode) {
    setMode(newMode);
    if (newMode === "sales") {
      navigate("/sales");
    } else {
      navigate("/");
    }
  }

  return (
    <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
      <ModeButton
        active={!isSales}
        onClick={() => handleSwitch("marketing")}
        icon={<Megaphone className="w-3.5 h-3.5" />}
        label="Marketing"
      />
      <ModeButton
        active={isSales}
        onClick={() => handleSwitch("sales")}
        icon={<Target className="w-3.5 h-3.5" />}
        label="Sales"
      />
    </div>
  );
}

function ModeButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
