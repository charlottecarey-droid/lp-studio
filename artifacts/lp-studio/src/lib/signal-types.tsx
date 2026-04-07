/**
 * Shared signal type configuration — single source of truth for
 * signal labels, icons, colors, and the type list used across
 * the dashboard, signals page, contacts, and outreach views.
 */
import {
  Activity,
  Eye,
  Mail,
  MousePointerClick,
  FileText,
  Send,
  UserSearch,
} from "lucide-react";

export const SIGNAL_TYPES = [
  "page_view",
  "email_open",
  "email_click",
  "email_sent",
  "email_replied",
  "form_submit",
  "visitor_identified",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

const SIGNAL_CONFIG: Record<
  string,
  { label: string; Icon: typeof Activity; color: string }
> = {
  page_view:           { label: "Page view",           Icon: Eye,               color: "text-blue-500" },
  email_open:          { label: "Email open",          Icon: Mail,              color: "text-emerald-500" },
  email_click:         { label: "Email click",         Icon: MousePointerClick, color: "text-amber-500" },
  form_submit:         { label: "Form submit",         Icon: FileText,          color: "text-violet-500" },
  email_sent:          { label: "Email sent",          Icon: Send,              color: "text-primary" },
  email_replied:       { label: "Email reply",         Icon: Mail,              color: "text-violet-500" },
  visitor_identified:  { label: "Visitor identified",  Icon: UserSearch,        color: "text-rose-500" },
};

const FALLBACK = { label: "", Icon: Activity, color: "text-muted-foreground" };

/** Returns a JSX icon element for the given signal type. */
export function getSignalIcon(type: string, size = "w-4 h-4") {
  const { Icon, color } = SIGNAL_CONFIG[type] ?? FALLBACK;
  return <Icon className={`${size} ${color}`} />;
}

/** Returns a human-readable label for the given signal type. */
export function getSignalLabel(type: string): string {
  return SIGNAL_CONFIG[type]?.label ?? type.replace(/_/g, " ");
}

/** Engagement scoring weights (also used by backend in signals.ts). */
export const SIGNAL_WEIGHTS: Record<string, number> = {
  form_submit: 5,
  email_click: 3,
  link_click: 3,
  email_open: 2,
  page_view: 1,
  email_sent: 0,
};
