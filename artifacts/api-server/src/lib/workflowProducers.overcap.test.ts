/**
 * Unit tests for the audience safety-cap refusal (Task #626). No DB: the store
 * + resolver are mocked so we can drive a single workflow whose live audience
 * sits just over / just under AUDIENCE_CAP and assert the producer's behaviour:
 *
 *   - OVER cap  → refuses outright (no enroll() call) and logs an error.
 *   - UNDER cap → enrolls each matching recipient and logs the fire.
 *
 * Seeding >10k real users isn't practical, so the cap path is verified here with
 * a stubbed count; the happy path's real-DB dedupe/idempotency is covered by
 * workflowProducers.integration.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { enrollMock, listWorkflowsMock, countMock, listRecipientsMock, loggerMock } = vi.hoisted(() => ({
  enrollMock: vi.fn(async () => 1),
  listWorkflowsMock: vi.fn(),
  countMock: vi.fn(),
  listRecipientsMock: vi.fn(),
  loggerMock: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("./logger", () => ({ logger: loggerMock }));

vi.mock("./workflowStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./workflowStore")>();
  return { ...actual, enroll: enrollMock, listEnabledWorkflowsByTriggerType: listWorkflowsMock };
});

vi.mock("./workflowAudience", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./workflowAudience")>();
  return { ...actual, countAudience: countMock, listAudienceRecipients: listRecipientsMock };
});

import { produceAudienceEnrollments, AUDIENCE_CAP } from "./workflowProducers";

const WORKFLOW = {
  id: 42,
  definition: { steps: [{ id: "s1", templateKey: "welcome", channels: ["email"], delayMs: 0, condition: null, branch: null, next: null }] },
};

function rowsForAudience() {
  return [{ workflow: WORKFLOW, triggerConfig: { role: "member" } }];
}

beforeEach(() => {
  vi.clearAllMocks();
  enrollMock.mockResolvedValue(1);
  listWorkflowsMock.mockResolvedValue(rowsForAudience());
});

describe("audience cap refusal (Task #626)", () => {
  it("refuses to enroll when the live audience exceeds the cap and logs the error", async () => {
    countMock.mockResolvedValue(AUDIENCE_CAP + 1);

    const { enrolled } = await produceAudienceEnrollments();

    expect(enrolled).toBe(0);
    expect(listRecipientsMock).not.toHaveBeenCalled();
    expect(enrollMock).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    const [meta, msg] = loggerMock.error.mock.calls[0];
    expect(msg).toContain("refusing to enroll");
    expect(meta).toMatchObject({
      workflowId: 42,
      triggerType: "audience",
      audience: "role=member",
      recipientCount: AUDIENCE_CAP + 1,
      cap: AUDIENCE_CAP,
    });
  });

  it("enrolls each recipient and logs the fire when under the cap", async () => {
    countMock.mockResolvedValue(2);
    listRecipientsMock.mockResolvedValue([
      { appUserId: 1, email: "a@x.com", name: "A", tenantId: null },
      { appUserId: 2, email: "b@x.com", name: "B", tenantId: 7 },
    ]);

    const { enrolled } = await produceAudienceEnrollments();

    expect(enrolled).toBe(2);
    expect(enrollMock).toHaveBeenCalledTimes(2);
    expect(loggerMock.error).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledTimes(1);
    const [meta] = loggerMock.info.mock.calls[0];
    expect(meta).toMatchObject({
      workflowId: 42,
      triggerType: "audience",
      recipientCount: 2,
      enrolled: 2,
      occurrenceId: "match",
    });
  });
});
