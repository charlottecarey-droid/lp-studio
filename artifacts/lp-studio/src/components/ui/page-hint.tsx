import { useState, isValidElement, type ReactNode } from "react";
import { X, Lightbulb, type LucideIcon } from "lucide-react";

const HINT_COLORS = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800/40", icon: "text-blue-500", text: "text-blue-900 dark:text-blue-100", muted: "text-blue-700/70 dark:text-blue-300/70", dismiss: "text-blue-400 hover:text-blue-600 dark:hover:text-blue-200" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800/40", icon: "text-violet-500", text: "text-violet-900 dark:text-violet-100", muted: "text-violet-700/70 dark:text-violet-300/70", dismiss: "text-violet-400 hover:text-violet-600 dark:hover:text-violet-200" },
  amber:  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800/40", icon: "text-amber-500", text: "text-amber-900 dark:text-amber-100", muted: "text-amber-700/70 dark:text-amber-300/70", dismiss: "text-amber-400 hover:text-amber-600 dark:hover:text-amber-200" },
  emerald:{ bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/40", icon: "text-emerald-500", text: "text-emerald-900 dark:text-emerald-100", muted: "text-emerald-700/70 dark:text-emerald-300/70", dismiss: "text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-200" },
  rose:   { bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800/40", icon: "text-rose-500", text: "text-rose-900 dark:text-rose-100", muted: "text-rose-700/70 dark:text-rose-300/70", dismiss: "text-rose-400 hover:text-rose-600 dark:hover:text-rose-200" },
} as const;

type HintColor = keyof typeof HINT_COLORS;

interface PageHintProps {
  /** Unique key for localStorage dismiss persistence */
  id: string;
  /** Short bold title */
  title: string;
  /** Longer description of what this page does and how to use it */
  description: string;
  /** Optional bullet-point tips */
  tips?: string[];
  /** Color theme */
  color?: HintColor;
  /** Custom icon — pass a LucideIcon component (e.g. Zap) or a JSX element (e.g. <Zap />) */
  icon?: LucideIcon | ReactNode;
}

export function PageHint({ id, title, description, tips, color = "blue", icon = Lightbulb }: PageHintProps) {
  const storageKey = `hint-dismissed-${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  const c = HINT_COLORS[color];

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(storageKey, "1"); } catch { /* noop */ }
  }

  return (
    <div className={`${c.bg} ${c.border} border rounded-lg px-4 py-3 relative`}>
      <button
        onClick={dismiss}
        className={`absolute top-2.5 right-2.5 p-0.5 rounded-md ${c.dismiss} transition-colors`}
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex gap-3">
        <div className={`flex-shrink-0 mt-0.5 ${c.icon}`}>
          {isValidElement(icon)
            ? icon
            : (() => { const Icon = icon as LucideIcon; return <Icon className="w-4 h-4" />; })()}
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className={`text-[13px] font-semibold ${c.text} mb-0.5`}>{title}</p>
          <p className={`text-[12px] ${c.muted} leading-relaxed`}>{description}</p>
          {tips && tips.length > 0 && (
            <ul className={`mt-2 flex flex-col gap-1 text-[12px] ${c.muted}`}>
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className={`w-1 h-1 rounded-full ${c.icon.replace("text-", "bg-")} mt-1.5 flex-shrink-0`} />
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export { HINT_COLORS };
export type { HintColor };
