import type { ReactNode } from "react";

/**
 * Shared building blocks for the Settings hub, so every tab reads the same
 * way: a short section heading, then compact rows — a name, one line of help,
 * and the control on the right. Tabs put rows inside one <Card> with
 * `divide-y` instead of giving every setting its own card.
 */

/** A section heading with an optional one-line description. */
export function SettingsSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** One setting: name + one line of help on the left, the control on the right. */
export function SettingRow({
  title,
  description,
  note,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** A small line under the description, e.g. a plan requirement. */
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{description}</p>}
        {note}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

/** The single "you can't edit this" line a tab shows to non-admins. */
export function AdminOnlyNote() {
  return <p className="text-xs text-muted-foreground">Only admins can change these settings.</p>;
}
