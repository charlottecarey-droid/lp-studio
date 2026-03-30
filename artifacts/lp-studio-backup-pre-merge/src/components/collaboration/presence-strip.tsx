import { PresenceViewer } from "@/hooks/use-collaboration";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-pink-500",
  "bg-teal-500",
];

function colorForId(viewerId: string): string {
  let hash = 0;
  for (let i = 0; i < viewerId.length; i++) {
    hash = (hash * 31 + viewerId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PresenceStripProps {
  viewers: PresenceViewer[];
}

export function PresenceStrip({ viewers }: PresenceStripProps) {
  if (viewers.length === 0) return null;

  return (
    <div className="flex items-center gap-1" title="Currently viewing">
      <div className="flex -space-x-2">
        {viewers.slice(0, 5).map(viewer => (
          <Tooltip key={viewer.viewerId}>
            <TooltipTrigger asChild>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-background cursor-default select-none ${colorForId(viewer.viewerId)}`}
              >
                {initials(viewer.displayName)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {viewer.displayName} is viewing
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {viewers.length > 0 && (
        <span className="text-xs text-muted-foreground ml-1">
          {viewers.length === 1 ? "1 other" : `${viewers.length} others`} viewing
        </span>
      )}
    </div>
  );
}
