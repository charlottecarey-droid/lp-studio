import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, lpRoomActivityTable: {} }));
import { activityLabel } from "./partnerRoomActivity";

describe("what a change to a hub is called", () => {
  it("names the things a teammate would want to know about", () => {
    expect(activityLabel("POST", "/publish", { publish: true })).toBe("Published the hub");
    expect(activityLabel("POST", "/publish", { publish: false })).toBe("Unpublished the hub");
    expect(activityLabel("POST", "/remind", {})).toBe("Sent the customer a reminder");
    expect(activityLabel("PATCH", "/requests/12", { reply: "On it" })).toBe("Replied to a request");
    expect(activityLabel("PATCH", "/requests/12", { status: "done" })).toBe("Finished a request");
    expect(activityLabel("PUT", "/account", { team: {} })).toBe("Changed the team");
    expect(activityLabel("PUT", "/account", { account: {} })).toBe("Changed the account settings");
    expect(activityLabel("DELETE", "/practices", undefined)).toBe("Removed all practices");
  });
  it("says nothing for reads, dry runs and anything it does not know", () => {
    expect(activityLabel("GET", "/practices", undefined)).toBeNull();
    expect(activityLabel("POST", "/welcome-kits", { dryRun: true })).toBeNull();
    expect(activityLabel("POST", "/welcome-kits", { ids: [1] })).toBe("Sent welcome kits");
    expect(activityLabel("POST", "/digest/preview", {})).toBeNull();
    expect(activityLabel("POST", "/kit-asset", {})).toBeNull();
  });
});
