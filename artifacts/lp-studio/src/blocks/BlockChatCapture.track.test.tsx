/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

/**
 * POST /lp/track requires `sessionId` (TrackEventBody in @workspace/api-zod —
 * not importable here, it's server-side only, so this pins the payload shape
 * instead).
 *
 * The chat-capture block only receives a sessionId when an A/B test is
 * running, and `JSON.stringify` silently drops undefined keys. So on every
 * plain (non-A/B) page the conversion POST failed schema validation with a
 * 400 and the lead never reached lp_events — observed live on
 * lp.meetdandy.com/inside-dandy, 2026-08-03. BlockForm and
 * BlockDandyFormRightAlt already had the anonymous fallback; this block was
 * written to "mirror BlockForm" and missed it.
 */

/** Mirrors the trackBody construction in BlockChatCapture's submit handler. */
function serialisedTrackBody(sessionId: string | undefined, anonSessionId: string) {
  const trackBody: Record<string, unknown> = {
    sessionId: sessionId ?? anonSessionId,
    eventType: "conversion",
    conversionType: "form_submit",
  };
  return JSON.parse(JSON.stringify(trackBody)) as Record<string, unknown>;
}

describe("chat-capture conversion tracking payload", () => {
  it("uses the A/B session id when one is supplied", () => {
    const body = serialisedTrackBody("sess-123", "anon-x");
    expect(body.sessionId).toBe("sess-123");
  });

  it("REGRESSION: still sends a sessionId on a page with no A/B test", () => {
    const body = serialisedTrackBody(undefined, "anon-abc123");
    // The key must SURVIVE serialisation — this is exactly what broke.
    expect("sessionId" in body).toBe(true);
    expect(typeof body.sessionId).toBe("string");
    expect(body.sessionId).toBe("anon-abc123");
  });

  it("shows why the old payload 400'd: undefined is dropped by stringify", () => {
    const broken = JSON.parse(JSON.stringify({
      sessionId: undefined,
      eventType: "conversion",
      conversionType: "form_submit",
    })) as Record<string, unknown>;
    expect("sessionId" in broken).toBe(false);
  });
});
