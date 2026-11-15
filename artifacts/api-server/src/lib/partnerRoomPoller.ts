// Partner rooms background work, on one timer:
//   - every tick: re-read each room's connected practice sheet when it was
//     last read more than 55 minutes ago (so the room tracks the sheet);
//   - every tick: re-read each room's connected Google Calendar on the same
//     55-minute rule, and draft minutes for finished meetings with notes;
//   - Mondays 14:00–20:00 UTC: send each room's weekly digest once
//     (sendRoomDigest claims the week atomically, so a second app instance
//     or a restart cannot send it twice).
// Production-only unless ROOM_POLLER_ENABLED=1; never throws.
import { logger } from "./logger";
import { isDigestWindow } from "./partnerRoomDigest";
import { calendarsDue, syncRoomCalendar } from "./partnerRoomCalendar";
import { roomsDueForWork, sendRoomDigest, syncPracticesFromSheet } from "./partnerRoomService";

const TICK_MS = 15 * 60 * 1000;
let inflight = false;

export async function runPartnerRoomTick(now: Date = new Date()): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    const due = await roomsDueForWork();
    for (const pageId of due.sheets.slice(0, 50)) {
      await syncPracticesFromSheet(pageId).catch((err) => logger.error({ err, pageId }, "room sheet sync tick failed"));
    }
    for (const pageId of (await calendarsDue()).slice(0, 50)) {
      await syncRoomCalendar(pageId).catch((err) => logger.error({ err, pageId }, "room calendar sync tick failed"));
    }
    if (isDigestWindow(now)) {
      for (const pageId of due.digest.slice(0, 200)) {
        const r = await sendRoomDigest(pageId, { scheduled: true, now }).catch((err) => {
          logger.error({ err, pageId }, "room digest tick failed");
          return null;
        });
        if (r?.sent) logger.info({ pageId, emails: r.emails, slack: r.slack }, "room digest sent");
      }
    }
  } catch (err) {
    logger.error({ err }, "partner room tick failed");
  } finally {
    inflight = false;
  }
}

export function startPartnerRoomPoller(): void {
  const enabled = process.env.ROOM_POLLER_ENABLED === "1" || process.env.NODE_ENV === "production";
  if (!enabled) return;
  setInterval(() => void runPartnerRoomTick(), TICK_MS).unref?.();
  logger.info("partner room poller started");
}
