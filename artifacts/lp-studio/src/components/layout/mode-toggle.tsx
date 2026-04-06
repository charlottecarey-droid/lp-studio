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
      <div className="relative flex items-center bg-sidebar-foreground/5 border border-sidebar-foreground/8 rounded-md p-0.5 w-full">
        <div className="absolute top-0.5 bottom-0.5 w-[calc(100%-4px)] left-0.5 rounded-[5px] bg-sidebar-foreground/15" />
        <ModeButton
          active={true}
          onClick={() => {}}
          icon={<Megaphone className="w-3 h-3" />}
          label="Marketing"
        />
      </div>
    );
  }

  if (lockedMode === "sales") {
    return (
      <div className="relative flex items-center bg-sidebar-foreground/5 border border-sidebar-foreground/8 rounded-md p-0.5 w-full">
        <div className="absolute top-0.5 bottom-0.5 w-[calc(100%-4px)] left-0.5 rounded-[5px] bg-sidebar-foreground/15" />
        <ModeButton
          active={true}
          onClick={() => {}}
          icon={<Target className="w-3 h-3" />}
          label="Sales"
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center bg-sidebar-foreground/5 border border-sidebar-foreground/8 rounded-md p-0.5 gap-0 w-full">
      <div
        className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-[5px] bg-sidebar-foreground/15 transition-all duration-200 ease-out"
        style={{ left: isSales ? "calc(50% + 2px)" : "2px" }}
      />
      <ModeButton
        active={!isSales}
        onClick={() => handleSwitch("marketing")}
        icon={<Megaphone className="w-3 h-3" />}
        label="Marketing"
      />
      <ModeButton
        active={isSales}
        onClick={() => handleSwitch("sales")}
        icon={<Target className="w-3 h-3" />}
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
      className={`relative z-10 flex items-center justify-center gap-1.5 flex-1 py-1 rounded-[5px] text-[11px] font-medium tracking-wide transition-colors duration-150 ${
        active
          ? "text-sidebar-foreground"
          : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
