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

    fireEvent.click(screen.getByLabelText("Open a Gmail draft to Darby Tinker"));

    await waitFor(() => expect(window.open).toHaveBeenCalled());
    expect((window.open as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain("darby@example.com");
    // And the rep is told the card didn't make it, so they don't paste blind.
    await waitFor(() => {
      expect(toast.mock.calls.some(([arg]) => String((arg as { title?: string })?.title).includes("without the card"))).toBe(true);
    });
  });

  it("addresses the draft from the hotlink, not the loaded contact list", async () => {
    render(<EmailPreviewModal page={PAGE} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText("Open a Gmail draft to Darby Tinker"));
    await waitFor(() => expect(window.open).toHaveBeenCalled());
    expect((window.open as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain("darby@example.com");
  });
});
