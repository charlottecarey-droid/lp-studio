/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

/**
 * The Sales Console nav's right-hand cluster was four unrelated control shapes
 * — a bordered Sidekick pill, a bare gear icon, a 200px segmented mode switch
 * and a round avatar chip — with the mode switch (the least-used control)
 * rendered as the highest-contrast element on the bar.
 *
 * The gear is gone: its items are account-level, so they moved into the account
 * menu. That's the one change with a real failure mode — settings becoming
 * unreachable — so this asserts they're still there, still permission-gated,
 * and that no second settings control came back alongside them.
 */

const hasPerm = vi.fn(() => true);
const authState = { isAdmin: true };
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Charlotte Carey", email: "charlotte.carey@meetdandy.com", isAdmin: authState.isAdmin, avatarUrl: null },
    hasPerm,
    logout: vi.fn(),
  }),
}));
vi.mock("@/context/BrandConfigContext", () => ({
  useBrandConfig: () => ({ brand: { brandName: "Dandy", isDandy: true, logoUrl: null } }),
}));
vi.mock("@/components/layout/mode-toggle", () => ({
  ModeToggle: () => <div data-testid="mode-toggle" />,
}));
vi.mock("@/components/sales/SalesAssistantBar", () => ({
  SalesAssistantBar: () => <div data-testid="assistant" />,
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/sales/contacts", vi.fn()],
  Link: ({ children }: { href?: string; children: React.ReactNode }) => <span>{children}</span>,
}));

import { SalesTopNav } from "./sales-layout";

/** Radix dropdown triggers open on pointerdown, not click. */
function openAccountMenu() {
  fireEvent.pointerDown(
    screen.getByLabelText("Account menu"),
    new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }),
  );
}

describe("Sales Console nav", () => {
  afterEach(() => {
    cleanup();
    hasPerm.mockReturnValue(true);
    authState.isAdmin = true;
  });

  it("puts the four primary jobs in the bar, with Create for the rest", () => {
    render(<SalesTopNav />);
    // Campaigns is one of the jobs this console exists for — it used to be
    // buried in the dropdown behind the ROI calculator.
    for (const label of ["Accounts", "Activity", "Contacts", "Pages", "Campaigns", "Create"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText("Tools")).toBeNull();
    expect(screen.getByLabelText("Sidekick — sales assistant")).toBeTruthy();
  });

  it("reaches Settings through the account menu, not a separate gear", async () => {
    render(<SalesTopNav />);
    // Nothing in the bar is a standalone settings control any more.
    expect(screen.queryByLabelText(/settings/i)).toBeNull();

    openAccountMenu();
    await waitFor(() => expect(screen.getByText("Integrations")).toBeTruthy());
    for (const item of ["Brand Settings", "Team", "Roles", "Sign out"]) {
      expect(screen.getByText(item)).toBeTruthy();
    }
  });

  it("still gates the settings items on permissions", async () => {
    // Not an admin, no perms — the account menu keeps identity + sign out only.
    // isAdmin matters too: every item is gated on `hasPerm(x) || isAdmin`.
    hasPerm.mockReturnValue(false);
    authState.isAdmin = false;
    render(<SalesTopNav />);

    openAccountMenu();
    await waitFor(() => expect(screen.getByText("Sign out")).toBeTruthy());
    expect(screen.queryByText("Roles")).toBeNull();
  });
});
