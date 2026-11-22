// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRoom, VIEW_AS_READ_ONLY } from "./room-client";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("viewing the hub as one person", () => {
  it("reads the hub as them and refuses anything that would act in their name", async () => {
    window.history.replaceState(null, "", "/hub?preview=person&as=ana%40mb2.com");
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
        return new Response(JSON.stringify({ viewer: { email: "ana@mb2.com", name: "Ana Sample" }, viewAs: true, tasks: {}, requests: [], gift: { offered: true, accepted: false } }), { status: 200 });
      }),
    );
    const { result } = renderHook(() => useRoom(9101, true));
    await waitFor(() => expect(result.current.snapshot.status).toBe("ready"));
    // The state is asked for as Ana, and the hub says whose view it is.
    expect(calls[0]).toMatchObject({ url: "/api/lp/room/state", body: { as: "ana@mb2.com" } });
    expect(result.current.snapshot.viewAs).toEqual({ email: "ana@mb2.com", name: "Ana Sample" });
    expect(result.current.snapshot.viewer?.team).toBe(false);
    expect(result.current.snapshot.gift).toEqual({ offered: true, accepted: false });
    // Ticking, requesting and tracking never reach the server.
    const store = result.current.store!;
    expect(await store.setTaskDone("onboard-logo", true)).toEqual({ ok: false, error: VIEW_AS_READ_ONLY });
    expect(await store.sendRequest({ kind: "marketing", subject: "Accept your welcome gift", details: "x", assetKey: "onboard-gift" })).toEqual({ ok: false, error: VIEW_AS_READ_ONLY });
    store.trackView({ viewId: "v", sessionId: "s", module: "overview", seconds: 0 });
    expect(calls.map((c) => c.url)).toEqual(["/api/lp/room/state"]);
  });
});
