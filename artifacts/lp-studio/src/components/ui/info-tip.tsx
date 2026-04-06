import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const TIP_COLORS = {
  blue:   { icon: "text-blue-400 hover:text-blue-500", bg: "bg-blue-900 dark:bg-blue-100", text: "text-blue-50 dark:text-blue-900" },
  violet: { icon: "text-violet-400 hover:text-violet-500", bg: "bg-violet-900 dark:bg-violet-100", text: "text-violet-50 dark:text-violet-900" },
  amber:  { icon: "text-amber-400 hover:text-amber-500", bg: "bg-amber-900 dark:bg-amber-100", text: "text-amber-50 dark:text-amber-900" },
  emerald:{ icon: "text-emerald-400 hover:text-emerald-500", bg: "bg-emerald-900 dark:bg-emerald-100", text: "text-emerald-50 dark:text-emerald-900" },
  rose:   { icon: "text-rose-400 hover:text-rose-500", bg: "bg-rose-900 dark:bg-rose-100", text: "text-rose-50 dark:text-rose-900" },
  default:{ icon: "text-muted-foreground/50 hover:text-muted-foreground", bg: "bg-primary", text: "text-primary-foreground" },
} as const;

type TipColor = keyof typeof TIP_COLORS;

interface InfoTipProps {
  /** Tooltip text */
  content: string;
  /** Color accent */
  color?: TipColor;
  /** Size of the info icon */
  size?: "sm" | "md";
  /** Side of the tooltip */
  side?: "top" | "bottom" | "left" | "right";
  /** Additional className for the trigger */
  className?: string;
}

export function InfoTip({ content, color = "default", size = "sm", side = "top", className = "" }: InfoTipProps) {
  const c = TIP_COLORS[color];
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center ${c.icon} transition-colors cursor-help ${className}`}
            tabIndex={-1}
          >
            <Info className={iconSize} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className={`${c.bg} ${c.text} max-w-[260px] text-[12px] leading-relaxed px-3 py-2 rounded-lg shadow-lg`}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
