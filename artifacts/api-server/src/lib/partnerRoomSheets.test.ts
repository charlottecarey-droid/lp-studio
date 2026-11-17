import { beforeEach, describe, expect, it, vi } from "vitest";

const integration = vi.hoisted(() => ({ row: null as null | { config: unknown; enabled: boolean } }));
const getAccessToken = vi.hoisted(() => vi.fn(async () => ({ token: "sa-token" })));
const proxy = vi.hoisted(() => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ via: "replit" }), text: async () => "" })));

vi.mock("./lpIntegrationsStore", () => ({ getIntegration: vi.fn(async () => integration.row) }));
vi.mock("./logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("googleapis", () => ({ google: { auth: { JWT: class { constructor(public opts: unknown) {} getAccessToken = getAccessToken; } } } }));
vi.mock("@replit/connectors-sdk", () => ({ ReplitConnectors: class { proxy = proxy; } }));

import { __resetRoomSheets, roomSheetsAccount, roomSheetsRequest, sheetProblem } from "./partnerRoomSheets";

const SA = { config: { serviceAccountEmail: "robot@proj.iam.gserviceaccount.com", privateKey: "-----BEGIN KEY-----\\nabc\\n-----END KEY-----" }, enabled: true };
const fetchMock = vi.fn(async () => new Response(JSON.stringify({ values: [["Name"]] }), { status: 200 }));

beforeEach(() => {
  __resetRoomSheets();
  integration.row = null;
  getAccessToken.mockClear();
  proxy.mockClear();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Google Sheets for partner rooms", () => {
  it("signs in as the workspace's service account, the way lead sync does, and reuses the token", async () => {
    integration.row = SA;
    expect(await roomSheetsAccount(1)).toBe("robot@proj.iam.gserviceaccount.com");
    const r = await roomSheetsRequest(1, "/v4/spreadsheets/abc/values/A1");
    expect(r).toMatchObject({ ok: true, status: 200, sharedWith: "robot@proj.iam.gserviceaccount.com" });
    expect(await r.json()).toEqual({ values: [["Name"]] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string>; method: string }];
    expect(url).toBe("https://sheets.googleapis.com/v4/spreadsheets/abc/values/A1");
    expect(init.headers.Authorization).toBe("Bearer sa-token");
    await roomSheetsRequest(1, "/v4/spreadsheets/abc:batchUpdate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(proxy).not.toHaveBeenCalled();
  });

  it("still works for lead sync switched off, as long as the key is saved", async () => {
    integration.row = { ...SA, enabled: false };
    expect((await roomSheetsRequest(1, "/v4/x")).sharedWith).toBe("robot@proj.iam.gserviceaccount.com");
  });

  it("a key Google refuses comes back as a 401, not a crash", async () => {
    integration.row = SA;
    getAccessToken.mockRejectedValueOnce(new Error("invalid_grant"));
    const r = await roomSheetsRequest(1, "/v4/x");
    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the Replit connection only when the workspace has no service account", async () => {
    expect(await roomSheetsAccount(2)).toBeNull();
    const r = await roomSheetsRequest(2, "/v4/x");
    expect(await r.json()).toEqual({ via: "replit" });
    expect(proxy).toHaveBeenCalledWith("google-sheet", "/v4/x", { method: "GET" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says what to do about each refusal", () => {
    expect(sheetProblem(400, "robot@x", "Sheet 14")).toContain("no tab named “Sheet 14”");
    expect(sheetProblem(403, "robot@x")).toBe("Couldn't open the sheet. Share it with robot@x, and check the tab name.");
    expect(sheetProblem(404, "robot@x", "", "edit")).toContain("robot@x as an Editor");
    expect(sheetProblem(401, "robot@x")).toContain("couldn't sign in");
    expect(sheetProblem(500, "robot@x")).toBe("Google Sheets returned an error (500).");
  });
});
