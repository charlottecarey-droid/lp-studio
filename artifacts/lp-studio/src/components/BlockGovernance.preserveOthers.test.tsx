// @vitest-environment jsdom
/**
 * Regression: saving governance for ONE block must not wipe other blocks'
 * governance entries (task: "Protect block governance settings from being
 * accidentally overwritten").
 *
 * Both governance editors persist via the SAME full-replace PUT
 * (PUT /api/tenant/block-governance — the server deletes every row for the
 * tenant and re-inserts whatever the client sends). The only thing keeping an
 * edit to one block from clobbering the rest is the CLIENT-SIDE merge inside
 * each editor's `handleSave`:
 *   - BlockGovernancePanel: merges `{ ...seeded, ...overrides }` and emits all
 *     non-default entries.
 *   - BlockGovernanceTab (Block Defaults editor): `entries.filter(≠ this) then
 *     push this block's entry`.
 *
 * These tests render the REAL editors, drive an edit to a single block, click
 * Save, and assert the captured save payload still carries every other block's
 * pre-existing governance — verbatim. The shared per-block controls are stubbed
 * (radix Select/Switch/Checkbox aren't the unit under test) while the real
 * default-detection helper is kept so the "drop all-default rows" rule is still
 * exercised.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { TenantBlockGovernanceEntry } from "@/lib/block-governance-client";

// Stub the shared controls: a per-block button that, when clicked, fires an
// edit (enabled -> false, a divergent/non-default override) for that block.
vi.mock("@/components/BlockGovernanceControls", async (importActual) => {
  const actual = await importActual<typeof import("@/components/BlockGovernanceControls")>();
  return {
    ...actual,
    BlockGovernanceControls: ({
      entry,
      onChange,
      enableLabel,
    }: {
      entry: { enabled: boolean | null; aiMode: string; segments: Set<string> };
      onChange: (next: { enabled: boolean | null; aiMode: string; segments: Set<string> }) => void;
      enableLabel?: string;
    }) => (
      <button
        type="button"
        data-testid={`edit-${enableLabel ?? "block"}`}
        onClick={() =>
          onChange({ enabled: false, aiMode: entry.aiMode, segments: new Set(entry.segments) })
        }
      >
        edit {enableLabel}
      </button>
    ),
  };
});

// Heavy siblings pulled in by block-defaults.tsx that have nothing to do with
// governance — stub so the module imports cheaply in jsdom.
vi.mock("@/components/layout/app-layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/blocks/BlockRenderer", () => ({ BlockRenderer: () => null }));
vi.mock("@/pages/builder/property-panels/PropertyPanel", () => ({ PropertyPanel: () => null }));
vi.mock("@/components/SaveToLibraryDialog", () => ({ SaveToLibraryDialog: () => null }));

// Toast is fire-and-forget; silence it.
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

// Catalog + governance hooks are mocked per-test for the Panel path.
const saveSpy = vi.fn<(next: TenantBlockGovernanceEntry[]) => Promise<boolean>>();
const catalogState = { blocks: [] as Array<{ type: string; label: string; category: string }>, loading: false };
const govState = {
  entries: [] as TenantBlockGovernanceEntry[],
  governanceMap: new Map(),
  save: saveSpy,
  loading: false,
  saving: false,
  error: null as string | null,
};
vi.mock("@/hooks/use-block-catalog", () => ({ useBlockCatalog: () => catalogState }));
vi.mock("@/hooks/use-tenant-block-governance", () => ({ useTenantBlockGovernance: () => govState }));

import { BlockGovernancePanel } from "@/components/BlockGovernancePanel";
import { BlockGovernanceTab } from "@/pages/block-defaults";

/** Two pre-existing governance overrides we expect to survive any single edit. */
function existingEntries(): TenantBlockGovernanceEntry[] {
  return [
    { blockType: "hero", enabled: false, aiMode: "open", segments: [] },
    { blockType: "pricing-table", enabled: null, aiMode: "locked", segments: ["s1", "s2"] },
  ];
}

beforeEach(() => {
  saveSpy.mockReset();
  saveSpy.mockResolvedValue(true);
  cleanup();
});

describe("governance save preserves other blocks' entries", () => {
  it("BlockGovernancePanel: editing one block keeps every other block's governance", async () => {
    catalogState.blocks = [
      { type: "hero", label: "Hero", category: "Headers" },
      { type: "pricing-table", label: "Pricing Table", category: "Commerce" },
      { type: "faq", label: "FAQ", category: "Content" },
    ];
    govState.entries = existingEntries();

    render(<BlockGovernancePanel segments={[]} />);

    // Edit ONLY the hero block, then save.
    fireEvent.click(screen.getByTestId("edit-Hero"));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const payload = saveSpy.mock.calls[0][0];
    const byType = Object.fromEntries(payload.map((e) => [e.blockType, e]));

    // The untouched pricing-table entry survives, byte-for-byte.
    expect(byType["pricing-table"]).toMatchObject({ enabled: null, aiMode: "locked" });
    expect([...byType["pricing-table"].segments].sort()).toEqual(["s1", "s2"]);
    // The edited hero entry is present too.
    expect(byType["hero"]).toMatchObject({ enabled: false });
    // faq was never customized -> not persisted (all-default rows dropped).
    expect(byType["faq"]).toBeUndefined();
  });

  it("BlockGovernanceTab: editing the selected block keeps every other block's governance", async () => {
    render(
      <BlockGovernanceTab
        blockType="hero"
        blockLabel="Hero"
        segments={[]}
        entries={existingEntries()}
        save={saveSpy}
        saving={false}
        loading={false}
      />,
    );

    // Edit the currently-selected (hero) block, then save.
    fireEvent.click(screen.getByTestId("edit-Hero"));
    fireEvent.click(screen.getByRole("button", { name: /save governance/i }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const payload = saveSpy.mock.calls[0][0];
    const byType = Object.fromEntries(payload.map((e) => [e.blockType, e]));

    // The other block (pricing-table) is preserved untouched...
    expect(byType["pricing-table"]).toMatchObject({ enabled: null, aiMode: "locked" });
    expect([...byType["pricing-table"].segments].sort()).toEqual(["s1", "s2"]);
    // ...and the edited block is swapped in.
    expect(byType["hero"]).toMatchObject({ enabled: false });
  });
});
