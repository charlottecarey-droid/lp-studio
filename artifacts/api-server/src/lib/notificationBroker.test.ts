import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

interface FakeClient extends EventEmitter {
  connectMock: ReturnType<typeof vi.fn>;
  queryMock: ReturnType<typeof vi.fn>;
  endMock: ReturnType<typeof vi.fn>;
  connect: (...a: unknown[]) => unknown;
  query: (...a: unknown[]) => unknown;
  end: (...a: unknown[]) => unknown;
}

// Capture every Client the broker constructs so the test can drive its
// lifecycle (connect, LISTEN, emit notifications). Declared with `var` so the
// hoisted vi.mock factory can close over it safely.
// eslint-disable-next-line no-var
var clients: FakeClient[] = [];

vi.mock("pg", async () => {
  const { EventEmitter: EE } = await import("node:events");
  class FakeClientImpl extends EE {
    connectMock = vi.fn(async () => {});
    queryMock = vi.fn(async () => ({ rows: [] }));
    endMock = vi.fn(async () => {});
    constructor(public opts: unknown) {
      super();
      clients.push(this as unknown as FakeClient);
    }
    connect = (...a: unknown[]) => this.connectMock(...a);
    query = (...a: unknown[]) => this.queryMock(...a);
    end = (...a: unknown[]) => this.endMock(...a);
  }
  return { default: { Client: FakeClientImpl } };
});

const poolQueryMock = vi.fn(async () => ({ rows: [] }));
vi.mock("@workspace/db", () => ({
  pool: { query: (...a: unknown[]) => poolQueryMock(...a) },
}));

import {
  INSTANCE_ID,
  startNotificationBroker,
  publishNotificationEvent,
  stopNotificationBroker,
  isBrokerStarted,
  type BrokerMessage,
} from "./notificationBroker";

const payload = {
  id: 5,
  templateKey: "trial_day_7",
  title: "T",
  body: "B",
  ctaUrl: null,
  ctaLabel: null,
  read: false,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  clients.length = 0;
  poolQueryMock.mockClear();
  process.env["NOTIFY_DATABASE_URL"] = "postgres://x/y";
});

afterEach(async () => {
  await stopNotificationBroker();
});

/** Wait a tick for the broker's detached connect() to settle. */
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("notificationBroker", () => {
  it("does not publish before the broker is started", () => {
    publishNotificationEvent({ originId: INSTANCE_ID, tenantId: 1, appUserId: 2, payload });
    expect(poolQueryMock).not.toHaveBeenCalled();
    expect(isBrokerStarted()).toBe(false);
  });

  it("connects a dedicated client and issues LISTEN on start", async () => {
    startNotificationBroker(() => {});
    await tick();
    expect(clients.length).toBe(1);
    expect(clients[0].connectMock).toHaveBeenCalledTimes(1);
    expect(clients[0].queryMock).toHaveBeenCalledWith("LISTEN notification_events");
  });

  it("delivers remote messages from other instances but skips its own echo", async () => {
    const handler = vi.fn();
    startNotificationBroker(handler);
    await tick();
    const client = clients[0];

    // Foreign origin -> delivered.
    const foreign: BrokerMessage = { originId: "other-instance", tenantId: 7, appUserId: 1, payload };
    client.emit("notification", { channel: "notification_events", payload: JSON.stringify(foreign) });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(foreign);

    // Own echo -> skipped (already delivered locally on the origin instance).
    const own: BrokerMessage = { originId: INSTANCE_ID, tenantId: 7, appUserId: 1, payload };
    client.emit("notification", { channel: "notification_events", payload: JSON.stringify(own) });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("publishes via pg_notify once started", async () => {
    startNotificationBroker(() => {});
    await tick();
    publishNotificationEvent({ originId: INSTANCE_ID, tenantId: 3, appUserId: 4, payload });
    expect(poolQueryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = poolQueryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("pg_notify");
    expect(params[0]).toBe("notification_events");
    expect(JSON.parse(params[1] as string).tenantId).toBe(3);
  });

  it("skips the broker hop when the payload exceeds the NOTIFY limit", async () => {
    startNotificationBroker(() => {});
    await tick();
    const huge = { ...payload, body: "x".repeat(8000) };
    publishNotificationEvent({ originId: INSTANCE_ID, tenantId: 3, appUserId: 4, payload: huge });
    expect(poolQueryMock).not.toHaveBeenCalled();
  });
});
