// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { PageContextProvider } from "@/lib/page-context";
import { BlockRoomWorkspace, ROOM_WORKSPACE_DEFAULT_PROPS, type RoomWorkspaceBlockProps } from "../BlockRoomWorkspace";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const props: RoomWorkspaceBlockProps = {
  ...structuredClone(ROOM_WORKSPACE_DEFAULT_PROPS),
  partnerName: "Del Dental",
  planGroups: [
    { title: "Setup", rows: [{ key: "a", task: "Step A" }, { key: "b", task: "Step B" }] },
    { title: "Launch", rows: [{ key: "d", task: "Step D" }] },
  ],
};

let nextPageId = 9201;

function hubAs(team: boolean, planDelete: { ok: boolean; error?: string } = { ok: true }) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, body });
      if (url.endsWith("/plan-delete")) return new Response(JSON.stringify(planDelete.ok ? { ok: true, removed: (body.keys as string[]).length } : { error: planDelete.error }), { status: planDelete.ok ? 200 : 500 });
      return new Response(JSON.stringify({ viewer: { email: "rae@vendor.com", name: "Rae Rep", ...(team ? { team: true } : {}) }, tasks: {}, requests: [] }), { status: 200 });
    }),
  );
  // Each test its own page id: the hub keeps one data store per page for the whole window.
  const pageId = nextPageId++;
  render(createElement(PageContextProvider, { value: { pageId, sessionId: "s1" } }, createElement(BlockRoomWorkspace, { props, brand: { ...DEFAULT_BRAND, brandName: "Acme" } })));
  return calls;
}

async function openPlan() {
  fireEvent.click(await screen.findByRole("button", { name: /^Action plan/ }));
  await screen.findByText("Step A");
}

describe("Action plan: the team deletes several steps at once", () => {
  it("ticks steps (one by one, or a whole phase), confirms, and they're gone", async () => {
    const calls = hubAs(true);
    await openPlan();
    await waitFor(() => expect(screen.getByLabelText("Select Step A")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Select Step A"));
    fireEvent.click(screen.getByLabelText("Select every step in Launch"));
    const bar = screen.getByText("2 steps selected").closest("[data-room-plan-bulk]") as HTMLElement;
    fireEvent.click(within(bar).getByText("Delete"));
    expect(screen.getByText("Delete 2 steps?")).toBeTruthy();
    fireEvent.click(screen.getByText("Delete", { selector: "[data-room-plan-delete-confirm]" }));
    await waitFor(() => expect(screen.queryByText("Step A")).toBeNull());
    expect(screen.queryByText("Step D")).toBeNull();
    expect(screen.getByText("Step B")).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith("/plan-delete"))?.body).toMatchObject({ keys: ["a", "d"] });
  });

  it("if the server refuses, the steps come back and it says why", async () => {
    hubAs(true, { ok: false, error: "Could not delete the steps" });
    await openPlan();
    await waitFor(() => expect(screen.getByLabelText("Select Step B")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Select Step B"));
    fireEvent.click(within(screen.getByText("1 step selected").closest("[data-room-plan-bulk]") as HTMLElement).getByText("Delete"));
    fireEvent.click(screen.getByText("Delete", { selector: "[data-room-plan-delete-confirm]" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Could not delete/));
    expect(screen.getByText("Step B")).toBeTruthy();
  });

  it("a customer gets no tick boxes", async () => {
    hubAs(false);
    await openPlan();
    expect(screen.queryByLabelText("Select Step A")).toBeNull();
    expect(screen.queryByText(/steps? selected/)).toBeNull();
  });
});
