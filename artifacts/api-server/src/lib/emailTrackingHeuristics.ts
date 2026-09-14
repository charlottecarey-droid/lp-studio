/**
 * Shared heuristics for deciding whether an inbound email-tracking event is a
 * real human or an automated prefetch.
 *
 * Gmail's image proxy and Apple Mail Privacy Protection fetch every image and
 * pre-resolve every link within milliseconds of delivery, and corporate link
 * scanners do the same. Counting those as opens and clicks is how an email
 * dashboard ends up claiming a 100% open rate.
 *
 * Lives here rather than inside the campaigns router because both tracking
 * paths need the identical rule: our own pixel/redirect endpoints, and the
 * Resend webhook that backstops them.
 */

/** Events landing within this long after the send are treated as automated. */
export const BOT_GRACE_MS = 2000;

/**
 * True when an open/click arrived suspiciously soon after the send. Callers
 * still serve the pixel or perform the redirect as normal — only the DB stamp
 * and the signal are suppressed.
 */
export function isLikelyBot(sentAt: Date | null | undefined): boolean {
  if (!sentAt) return false;
  return Date.now() - new Date(sentAt).getTime() < BOT_GRACE_MS;
}
