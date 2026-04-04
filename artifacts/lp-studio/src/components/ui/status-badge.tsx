import { type ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "muted" | "primary";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success:  "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50",
  warning:  "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50",
  danger:   "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50",
  info:     "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50",
  muted:    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-900/50",
  primary:  "bg-primary/10 text-primary border-primary/20",
};

/** Maps engagement score labels to badge variants. */
export const ENGAGEMENT_VARIANT: Record<string, BadgeVariant> = {
  "Hot": "danger",
  "Warm": "warning",
  "Cool": "info",
  "Cold": "muted",
  "No activity": "muted",
};

/** Maps page/campaign status to badge variants. */
export const STATUS_VARIANT: Record<string, BadgeVariant> = {
  published: "success",
  draft: "warning",
  sending: "primary",
  sent: "success",
  paused: "muted",
  active: "success",
  inactive: "muted",
};

interface StatusBadgeProps {
  /** The text to display inside the badge. */
  children: ReactNode;
  /** Visual variant — determines colors. */
  variant?: BadgeVariant;
  /** Convenience: auto-resolve variant from a status string (uses STATUS_VARIANT map). */
  status?: string;
  /** Convenience: auto-resolve variant from an engagement label (uses ENGAGEMENT_VARIANT map). */
  engagement?: string;
  /** Extra Tailwind classes to append. */
  className?: string;
  /** Show a small dot indicator instead of text. */
  dot?: boolean;
}

/**
 * Unified badge/pill component for status indicators, engagement tiers, and tags.
 *
 * Usage:
 *   <StatusBadge variant="success">Published</StatusBadge>
 *   <StatusBadge status="draft">Draft</StatusBadge>
 *   <StatusBadge engagement="Hot">Hot (15)</StatusBadge>
 *   <StatusBadge engagement="Warm" dot />
 */
export function StatusBadge({
  children,
  variant,
  status,
  engagement,
  className = "",
  dot = false,
}: StatusBadgeProps) {
  const resolved =
    variant ??
    (status ? STATUS_VARIANT[status] : undefined) ??
    (engagement ? ENGAGEMENT_VARIANT[engagement] : undefined) ??
    "muted";

  const colors = VARIANT_CLASSES[resolved];

  if (dot) {
    const dotColor = resolved === "danger" ? "bg-red-500"
      : resolved === "warning" ? "bg-amber-500"
      : resolved === "info" ? "bg-blue-500"
      : resolved === "success" ? "bg-emerald-500"
      : "bg-slate-300";
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${dotColor} ${className}`}
        title={typeof children === "string" ? children : undefined}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors} ${className}`}
    >
      {children}
    </span>
  );
}
