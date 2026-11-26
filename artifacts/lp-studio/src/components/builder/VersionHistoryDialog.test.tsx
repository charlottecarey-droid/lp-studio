/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { VersionHistoryDialog, reasonLabel } from "./VersionHistoryDialog";

const versions = [
  { id: 12, createdAt: "2026-11-26T15:00:00Z", createdBy: "rep@example.com", reason: "checkpoint", note: "Before CTA changes", title: "Page", status: "published", blockCount: 7 },
  { id: 11, createdAt: "2026-11-25T15:00:00Z", createdBy: null, reason: "save", note: null, title: "Page", status: "published", blockCount: 6 },
];

function mockFetch() {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
    if (url.includes("/versions")) return new Response(JSON.stringify({ versions }), { status: 200 });
    if (url.endsWith("/restore")) return new Response(JSON.stringify({ restored: true }), { status: 200 });
    if (url.endsWith("/checkpoint")) return new Response(JSON.stringify({ versionId: 13 }), { status: 201 });
    if (url.includes("/page-versions/12")) return new Response(JSON.stringify({ snapshot: { blocks: [{ type: "hero" }, { type: "faq" }] } }), { status: 200 });
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("VersionHistoryDialog", () => {
  it("lists versions with their notes and labels", async () => {
    mockFetch();
    render(<VersionHistoryDialog open onClose={() => {}} pageId={5} isDirty={false} isLive={false} onRestored={() => {}} />);
    expect(await screen.findByText("Before CTA changes")).toBeTruthy();
    expect(screen.getAllByTestId("version-row")).toHaveLength(2);
    expect(screen.getByText("Checkpoint")).toBeTruthy();
    expect(screen.getByText("Before editing")).toBeTruthy();
  });

  it("asks before restoring, warns about the live page and unsaved edits, then restores", async () => {
    const calls = mockFetch();
    const onRestored = vi.fn();
    render(<VersionHistoryDialog open onClose={() => {}} pageId={5} isDirty isLive onRestored={onRestored} />);
    await screen.findByText("Before CTA changes");
    fireEvent.click(screen.getAllByTestId("version-restore")[1]);
    expect(screen.getByText(/live page will change too/)).toBeTruthy();
    expect(screen.getByText(/unsaved changes will be lost/)).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith("/restore"))).toBe(false);
    fireEvent.click(screen.getByTestId("version-restore-confirm"));
    await waitFor(() => expect(onRestored).toHaveBeenCalled());
    expect(calls.find((c) => c.method === "POST")?.url).toBe("/api/lp/page-versions/11/restore");
  });

  it("saves a named checkpoint and reloads the list", async () => {
    const calls = mockFetch();
    render(<VersionHistoryDialog open onClose={() => {}} pageId={5} isDirty={false} isLive={false} onRestored={() => {}} />);
    await screen.findByText("Before CTA changes");
    fireEvent.change(screen.getByTestId("version-checkpoint-note"), { target: { value: "v3b ready" } });
    fireEvent.click(screen.getByTestId("version-checkpoint-save"));
    await waitFor(() => expect(calls.filter((c) => c.url.includes("/versions")).length).toBe(2));
    const post = calls.find((c) => c.url.endsWith("/checkpoint"));
    expect(post?.url).toBe("/api/lp/pages/5/checkpoint");
    expect(JSON.parse(post!.body!)).toEqual({ note: "v3b ready" });
  });

  it("shows a version's blocks when expanded", async () => {
    mockFetch();
    render(<VersionHistoryDialog open onClose={() => {}} pageId={5} isDirty={false} isLive={false} onRestored={() => {}} />);
    await screen.findByText("Before CTA changes");
    fireEvent.click(screen.getAllByLabelText("Show blocks")[0]);
    expect(await screen.findByText("hero → faq")).toBeTruthy();
  });

  it("labels reasons in plain words", () => {
    expect(reasonLabel("publish")).toBe("Before publishing");
    expect(reasonLabel("delete")).toBe("Before deleting");
  });
});
