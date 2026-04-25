import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type React from "react";

interface MuteToggleButtonProps {
  muted: boolean;
  /** Click handler. `onToggle` is kept as an alias for backward compatibility. */
  onClick?: (e: React.MouseEvent) => void;
  onToggle?: (e: React.MouseEvent) => void;
  className?: string;
}

export function MuteToggleButton({ muted, onClick, onToggle, className }: MuteToggleButtonProps) {
  const handler = onClick ?? onToggle;
  return (
    <button
      type="button"
      onClick={handler}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full",
        "bg-black/50 text-white hover:bg-black/70 transition-colors",
        "backdrop-blur-sm border border-white/10 shadow-md",
        className
      )}
      title={muted ? "Unmute video" : "Mute video"}
      aria-label={muted ? "Unmute video" : "Mute video"}
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}
