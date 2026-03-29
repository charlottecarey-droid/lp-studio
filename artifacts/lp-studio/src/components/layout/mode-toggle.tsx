import { useAppMode, type AppMode } from "@/lib/mode-context";
import { useLocation } from "wouter";
import { Megaphone, Target } from "lucide-react";

export function ModeToggle() {
  const { mode, setMode } = useAppMode();
  const [, navigate] = useLocation();

  function handleSwitch(newMode: AppMode) {
    setMode(newMode);
    // Navigate to the appropriate home when switching modes
    if (newMode === "sales") {
      navigate("/sales");
    } else {
      navigate("/");
    }
  }

  return (
    <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
      <ModeButton
        active={mode === "marketing"}
        onClick={() => handleSwitch("marketing")}
        icon={<Megaphone className="w-3.5 h-3.5" />}
        label="Marketing"
      />
      <ModeButton
        active={mode === "sales"}
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
