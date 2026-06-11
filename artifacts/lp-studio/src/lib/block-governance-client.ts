import {
  governanceMapFromRows,
  resolveBlockAvailable,
  isBlockApprovedForSegment,
  type GovernanceMap,
  type TenantBlockGovernanceEntry,
  type AiMode,
} from "@workspace/lp-template-engine";
import type { ResolvedBlockDef } from "@/hooks/use-block-catalog";

export type { GovernanceMap, TenantBlockGovernanceEntry, AiMode };
export { governanceMapFromRows, isBlockApprovedForSegment };

/**
 * Client mirror of the shared block-governance precedence model
 * (`@workspace/lp-template-engine/block-governance.ts`). The builder applies
 * the SAME resolver the api-server generator uses so the two never drift.
 *
 * Only layer 2 (tenant governance `enabled === false`) is applied here — the
 * superadmin kill-switch (layer 1) is already enforced by `useBlockCatalog`
 * (it drops `is_enabled: false` rows), and the cosmetic hide list (layer 3) is
 * applied separately by `applyBlockLibraryPrefs`. Fail-open: a block with no
 * governance row, or no map at all, stays available.
 */
export function applyGovernanceAvailability(
  blocks: ResolvedBlockDef[],
  governance: GovernanceMap | null | undefined,
): ResolvedBlockDef[] {
  if (!governance || governance.size === 0) return blocks;
  return blocks.filter((b) =>
    resolveBlockAvailable({ blockType: b.type, governance: governance.get(b.type) }),
  );
}

/**
 * Built-in catalog blocks the tenant has approved for a given brand segment
 * (governance `segments` contains the segment id) AND that are still available
 * (not governance-disabled). Drives the segment library / segment tab grouping.
 */
export function blocksApprovedForSegment(
  blocks: ResolvedBlockDef[],
  governance: GovernanceMap | null | undefined,
  segmentId: string,
): ResolvedBlockDef[] {
  if (!governance || governance.size === 0 || !segmentId) return [];
  return blocks.filter((b) => {
    const entry = governance.get(b.type);
    return (
      isBlockApprovedForSegment(entry, segmentId) &&
      resolveBlockAvailable({ blockType: b.type, governance: entry })
    );
  });
}
