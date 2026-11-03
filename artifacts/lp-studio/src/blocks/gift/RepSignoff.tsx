import { CalendarDays } from "lucide-react";
import { InlineText } from "@/components/InlineText";
import { cn } from "@/lib/utils";

/**
 * The rep's line under a gift note's signature: optional headshot, their
 * role, and an optional link to their own calendar (Chili Piper / Calendly /
 * any booking URL, opened in a new tab). Filled from the rep's Content
 * Library profile by the "From" picker in the note's panel, or typed by hand.
 * Renders nothing on the live page when there's no role, photo or link.
 */
export function RepSignoff({
  repTitle,
  repPhotoUrl,
  signature,
  calendarText,
  calendarUrl,
  ink,
  muted,
  line,
  accent,
  isEditor,
  onTitle,
  onCalendarText,
  className,
}: {
  repTitle?: string;
  repPhotoUrl?: string;
  signature?: string;
  calendarText?: string;
  calendarUrl?: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  isEditor: boolean;
  onTitle?: (v: string) => void;
  onCalendarText?: (v: string) => void;
  className?: string;
}) {
  const hasCalendar = !!(calendarUrl && calendarUrl.trim());
  const show = !!(repTitle || repPhotoUrl || hasCalendar) || isEditor;
  if (!show) return null;
  const label = calendarText || "Grab time on my calendar";
  return (
    <div data-gift-rep="true" className={cn("flex flex-col gap-4", className)}>
      {(repTitle || repPhotoUrl || isEditor) && (
        <div className="flex items-center gap-3">
          {repPhotoUrl && (
            <img src={repPhotoUrl} alt={signature ? `${signature}` : ""} className="h-11 w-11 rounded-full object-cover" style={{ boxShadow: `0 0 0 1px ${line}` }} loading="lazy" />
          )}
          {(repTitle || isEditor) && (
            <span className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: muted }}>
              <InlineText as="span" value={repTitle ?? ""} onUpdate={onTitle} />
            </span>
          )}
        </div>
      )}
      {(hasCalendar || isEditor) && (
        <a
          href={hasCalendar ? calendarUrl : "#"}
          target={hasCalendar ? "_blank" : undefined}
          rel="noreferrer"
          data-gift-calendar={hasCalendar ? "true" : "false"}
          className="inline-flex items-center gap-2 self-start text-[13px] font-semibold underline-offset-4 hover:underline"
          style={{ color: ink }}
        >
          <CalendarDays className="h-4 w-4" aria-hidden style={{ color: accent }} />
          <InlineText as="span" value={label} onUpdate={onCalendarText} />
        </a>
      )}
    </div>
  );
}
