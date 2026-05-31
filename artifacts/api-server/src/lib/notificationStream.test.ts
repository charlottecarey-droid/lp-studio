import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import {
  addStreamClient,
  publishInAppNotification,
  streamClientCount,
  type InAppStreamPayload,
} from "./notificationStream";

function fakeRes() {
  const writes: string[] = [];
  const res = {
    write: vi.fn((chunk: string) => {
      writes.push(chunk);
      return true;
    }),
  } as unknown as Response;
  return { res, writes };
}

const payload: InAppStreamPayload = {
  id: 99,
  templateKey: "trial_day_13",
  title: "Trial ends tomorrow",
  body: "Upgrade to keep your pages live.",
  ctaUrl: "https://acme.lpstudio.ai/billing",
  ctaLabel: "Upgrade",
  read: false,
  createdAt: new Date().toISOString(),
};

describe("notificationStream", () => {
  it("delivers a push only to clients matching the (tenant, user) pair", () => {
    const target = fakeRes();
    const otherUser = fakeRes();
    const otherTenant = fakeRes();

    const cleanupA = addStreamClient(7, 1, target.res);
    const cleanupB = addStreamClient(7, 2, otherUser.res);
    const cleanupC = addStreamClient(8, 1, otherTenant.res);

    publishInAppNotification(7, 1, payload);

    const sent = target.writes.find((w) => w.startsWith("event: notification"));
    expect(sent).toBeDefined();
    expect(sent).toContain(JSON.stringify(payload));
    // Wrong user / wrong tenant must not receive the event.
    expect(otherUser.writes.some((w) => w.startsWith("event: notification"))).toBe(false);
    expect(otherTenant.writes.some((w) => w.startsWith("event: notification"))).toBe(false);

    cleanupA();
    cleanupB();
    cleanupC();
  });

  it("stops delivering after the client cleans up", () => {
    const target = fakeRes();
    const cleanup = addStreamClient(11, 3, target.res);
    cleanup();

    publishInAppNotification(11, 3, payload);
    expect(target.writes.some((w) => w.startsWith("event: notification"))).toBe(false);
  });

  it("drops a client whose write throws and keeps healthy clients", () => {
    const healthy = fakeRes();
    const broken = {
      write: vi.fn(() => {
        throw new Error("socket closed");
      }),
    } as unknown as Response;

    const before = streamClientCount();
    const cleanupHealthy = addStreamClient(20, 5, healthy.res);
    addStreamClient(20, 5, broken);

    publishInAppNotification(20, 5, payload);

    expect(healthy.writes.some((w) => w.startsWith("event: notification"))).toBe(true);
    // The broken client was removed; only the healthy one remains over baseline.
    expect(streamClientCount()).toBe(before + 1);

    cleanupHealthy();
  });
});
