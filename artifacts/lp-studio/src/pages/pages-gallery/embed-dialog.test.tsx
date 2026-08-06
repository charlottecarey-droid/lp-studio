// @vitest-environment jsdom
/**
 * The embed dialog's one job is keeping the installed snippet and the
 * personalized links on the SAME query param — a stored token on the host
 * site is keyed by param name, so a link minted under a different param than
 * the snippet silently never personalizes (or hijacks another slot). These
 * tests pin that contract:
 *
 *   - the snippet's data-param and the copied link suffix both follow the
 *     edited param, from one input
 *   - the param is remembered per page, so reopening the dialog later mints
 *     links on the key the already-installed snippet uses
 *   - drafts can't copy either artifact (embeds only render published pages)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { EmbedDialog } from "./embed-dialog";
import type { Page } from "./types";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    domainContext: { micrositeDomain: "pages.example.com" },
    user: { tenantHost: null },
  }),
}));

const clipboardWrites: string[] = [];

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: 42,
    title: "Pepperpointe",
    slug: "pepperpointe",
    blocks: [],
    status: "published",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  } as Page;
}

beforeEach(() => {
  cleanup();
  clipboardWrites.length = 0;
  window.localStorage.clear();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn(async (t: string) => { clipboardWrites.push(t); }) },
  });
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ embedToken: "tok_abc123" }),
  })));
});

describe("EmbedDialog", () => {
  it("snippet and personalized link share the edited param", async () => {
    render(<EmbedDialog page={makePage()} onClose={() => {}} />);

    const input = screen.getByPlaceholderText("lp_page");
    fireEvent.change(input, { target: { value: "partner" } });

    fireEvent.click(screen.getByText("Copy snippet"));
    await waitFor(() => expect(clipboardWrites.length).toBe(1));
    expect(clipboardWrites[0]).toContain('data-param="partner"');
    expect(clipboardWrites[0]).toContain('data-page="pepperpointe"');
    expect(clipboardWrites[0]).toContain("https://pages.example.com/api/embed/page.js");

    fireEvent.click(screen.getByText("Copy personalized link suffix"));
    await waitFor(() => expect(clipboardWrites.length).toBe(2));
    expect(clipboardWrites[1]).toBe("?partner=tok_abc123");
    expect(fetch).toHaveBeenCalledWith("/api/lp/pages/42/embed-token", { method: "POST" });
  });

  it("remembers the param per page so later links match the installed snippet", async () => {
    const { unmount } = render(<EmbedDialog page={makePage()} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("lp_page"), { target: { value: "hero" } });
    fireEvent.click(screen.getByText("Copy snippet"));
    await waitFor(() => expect(clipboardWrites.length).toBe(1));
    unmount();

    render(<EmbedDialog page={makePage()} onClose={() => {}} />);
    expect((screen.getByPlaceholderText("lp_page") as HTMLInputElement).value).toBe("hero");
  });

  it("drafts can't copy — embeds only render published pages", () => {
    render(<EmbedDialog page={makePage({ status: "draft" })} onClose={() => {}} />);
    expect(screen.getByText(/Publish this page first/)).toBeTruthy();
    expect((screen.getByText("Copy snippet").closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Copy personalized link suffix").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("rejects param names that wouldn't survive a URL", () => {
    render(<EmbedDialog page={makePage()} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("lp_page"), { target: { value: "bad param!" } });
    expect(screen.getByText(/Letters, numbers, dashes and underscores only/)).toBeTruthy();
    expect((screen.getByText("Copy snippet").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
