import { createRequire } from "node:module";
import path from "node:path";

const requireFromHere = createRequire(import.meta.url);

export interface BlockCatalogSeedRow {
  block_type: string;
  label: string;
  category: string;
  sort_order: number;
  default_props: Record<string, unknown>;
}

// process.cwd() at runtime is artifacts/api-server (set by the workflow).
// The cjs seed lives at the monorepo root, two levels up.
const seedPath = path.resolve(process.cwd(), "../../scripts/seed-block-catalog.cjs");
const mod = requireFromHere(seedPath) as { GENERIC_SEED: BlockCatalogSeedRow[] };

export const GENERIC_BLOCK_CATALOG_SEED: BlockCatalogSeedRow[] = mod.GENERIC_SEED;
