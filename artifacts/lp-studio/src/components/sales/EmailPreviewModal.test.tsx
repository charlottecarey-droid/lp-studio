/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * Contract for the shared "Copy email preview" modal, now that four surfaces
 * open it (Pages table, Accounts → microsites) or reuse its copy hook (page
 * drill-down, Contacts).
 *
 * The load-bearing rule is the decoupling: the clipboard write and the compose
 * window are independent. A clipboard failure (denied permission, tab lost
 * focus mid-capture) must NOT swallow the draft — the compose body carries the
 * URL, so an un-pasted send is still a working email.
 */

const copyEmailPreview = vi.fn();
vi.mock("@/lib/email-preview", () => ({
  copyEmailPreview: (...args: unknown[]) => copyEmailPreview(...args),
  buildOutreachEmail: () => ({ subject: "Subject", body: "Body with the URL" }),
  buildGmailComposeUrl: ({ to }: { to?: string | null }) => `https://mail.google.com/?to=${to ?? ""}`,
  buildMailtoUrl: ({ to }: { to?: string | null }) => `mailto:${to ?? ""}`,
}));
vi.mock("@/lib/brand-config", () => ({ fetchBrandConfig: async () => null }));
// Workspace mail client — one draft button, not two. Mutable so a test can
// flip the workspace to "everything else".
const brandState = { outreachMailClient: "gmail" as "gmail" | "default" };
vi.mock("@/context/BrandConfigContext", () => ({
  useOptionalBrandConfig: () => ({ brand: { salesConsole: { outreachMailClient: brandState.outreachMailClient } } }),
}));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: (...args: unknown[]) => toast(...args) }));

import { EmailPreviewModal } from "./EmailPreviewModal";

const PAGE = {
  pageId: 7,
  pageTitle: "Bright Smiles Microsite",
  plainUrl: "https://pages.example.com/lp/bright-smiles",
  hotlinks: [
    { hotlinkId: 11, token: "tok11", contactId: 5, contactName: "Darby Tinker", contactEmail: "darby@example.com" },
  ],
};

describe("EmailPreviewModal", () => {
  beforeEach(() => {
    copyEmailPreview.mockReset().mockResolvedValue("rich");
    toast.mockReset();
    brandState.outreachMailClient = "gmail";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("offers the plain page link and any contact who already has one", async () => {
    render(<EmailPreviewModal page={PAGE} onClose={() => {}} />);
    expect(screen.getByText("Plain page link")).toBeTruthy();
    expect(screen.getByText(PAGE.plainUrl)).toBeTruthy();
    expect(screen.getByText("Darby Tinker")).toBeTruthy();
  });

  it("copies the card against the chosen link, not the first hotlink", async () => {
    render(<EmailPreviewModal page={PAGE} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Copy"));
    await waitFor(() => expect(copyEmailPreview).toHaveBeenCalled());
    expect(copyEmailPreview.mock.calls[0]![0]).toMatchObject({ pageId: 7, pageUrl: PAGE.plainUrl });
  });

  it("still opens the draft when the clipboard write fails", async () => {
    copyEmailPreview.mockRejectedValue(new Error("clipboard denied"));
    render(<EmailPreviewModal page={PAGE} onClose={() => {}} />);

    fireEvent.click(screen.getByLabelText("Open a draft to Darby Tinker in Gmail"));

    await waitFor(() => expect(window.open).toHaveBeenCalled());
    expect((window.open as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain("darby@example.com");
    // And the rep is told the card didn't make it, so they don't paste blind.
    await waitFor(() => {
      expect(toast.mock.calls.some(([arg]) => String((arg as { title?: string })?.title).includes("without the card"))).toBe(true);
    });
  });

  it("shows ONE draft button, matching the workspace's mail client", () => {
    // Gmail workspace: a Gmail draft button, and no mail-app twin beside it.
    render(<EmailPreviewModal page={PAGE} onClose={() => {}} />);
    expect(screen.getByLabelText("Open a draft to Darby Tinker in Gmail")).toBeTruthy();
    expect(screen.queryByLabelText(/in your email app/)).toBeNull();
    cleanup();

    // Everything-else workspace: the mailto button, and no Gmail twin.
    brandState.outreachMailClient = "default";
    render(<EmailPreviewModal page={PAGE} onClose={() => {}} />);
    expect(screen.getByLabelText("Open a draft to Darby Tinker in your email app")).toBeTruthy();
    expect(screen.queryByLabelText(/in Gmail/)).toBeNull();
  });

  it("addresses the draft from the hotlink, not the loaded contact list", async () => {
    render(<EmailPreviewModal page={PAGE} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText("Open a draft to Darby Tinker in Gmail"));
    await waitFor(() => expect(window.open).toHaveBeenCalled());
    expect((window.open as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain("darby@example.com");
  });
});
