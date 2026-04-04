import { useAppMode, type AppMode } from "@/lib/mode-context";
import { useLocation } from "wouter";
import { Megaphone, Target } from "lucide-react";

export function ModeToggle() {
  const { setMode, lockedMode } = useAppMode();
  const [location, navigate] = useLocation();

  const isSales = location === "/sales" || location.startsWith("/sales/");

  function handleSwitch(newMode: AppMode) {
    if (lockedMode) return;
    setMode(newMode);
    if (newMode === "sales") {
      navigate("/sales");
    } else {
      navigate("/");
    }
  }

  if (lockedMode === "marketing") {
    return (
      <div className="relative flex items-center bg-black/30 border border-white/10 rounded-xl p-1 w-full">
        <div className="absolute top-1 bottom-1 w-[calc(100%-8px)] left-1 rounded-[10px] bg-[#C7E738] shadow-lg" />
        <ModeButton
          active={true}
          onClick={() => {}}
          icon={<Megaphone className="w-3.5 h-3.5" />}
          label="Marketing"
        />
      </div>
    );
  }

  if (lockedMode === "sales") {
    return (
      <div className="relative flex items-center bg-black/30 border border-white/10 rounded-xl p-1 w-full">
        <div className="absolute top-1 bottom-1 w-[calc(100%-8px)] left-1 rounded-[10px] bg-[#C7E738] shadow-lg" />
        <ModeButton
          active={true}
          onClick={() => {}}
          icon={<Target className="w-3.5 h-3.5" />}
          label="Sales"
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center bg-black/30 border border-white/10 rounded-xl p-1 gap-0.5 w-full">
      <div
        className="absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-[10px] bg-[#C7E738] shadow-lg transition-all duration-250 ease-out"
        style={{ left: isSales ? "calc(50% + 2px)" : "4px" }}
      />
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
      className={`relative z-10 flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-[10px] text-xs font-bold tracking-wide transition-colors duration-200 ${
        active
          ? "text-[#001a14]"
          : "text-white/50 hover:text-white/80"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
