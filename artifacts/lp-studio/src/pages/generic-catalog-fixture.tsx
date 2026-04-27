import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { BLOCK_REGISTRY, type PageBlock } from "@/lib/block-types";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { DEFAULT_BRAND } from "@/lib/brand-config";

// Test-only fixture: renders every row of the generic block_catalog seed
// (injected by the no-Dandy-leak Playwright spec via window.__GENERIC_SEED__)
// using the neutral DEFAULT_BRAND, i.e. what a non-Dandy tenant sees.

export interface GenericSeedRow {
  block_type: string;
  default_props?: Record<string, unknown>;
}

declare global {
  interface Window {
    __GENERIC_SEED__?: GenericSeedRow[];
  }
}

interface ItemEBState {
  hasError: boolean;
  message: string;
}

class BlockErrorBoundary extends Component<
  { blockType: string; children: ReactNode },
  ItemEBState
> {
  state: ItemEBState = { hasError: false, message: "" };
  static getDerivedStateFromError(err: unknown): ItemEBState {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: unknown) {
    console.error(`[generic-catalog-fixture] block "${this.props.blockType}" crashed`, err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          data-testid="fixture-block-error"
          data-block-type={this.props.blockType}
          style={{ padding: 12, background: "#fee", color: "#900", fontFamily: "monospace", fontSize: 12 }}
        >
          [block "{this.props.blockType}" failed to render: {this.state.message}]
        </div>
      );
    }
    return this.props.children;
  }
}

interface FixtureItem {
  id: string;
  type: string;
  props: Record<string, unknown>;
  hasRegistryDef: boolean;
}

function buildItem(row: GenericSeedRow, index: number): FixtureItem {
  const def = BLOCK_REGISTRY.find((b) => b.type === row.block_type);
  const baseProps = def ? (def.defaultProps() as Record<string, unknown>) : {};
  return {
    id: `fixture-${row.block_type}-${index}`,
    type: row.block_type,
    props: { ...baseProps, ...(row.default_props ?? {}) },
    hasRegistryDef: Boolean(def),
  };
}

// PageBlock is a discriminated union per block_type — we resolved the type at
// runtime from the seed row, so widen through `unknown` to satisfy the union
// without an explicit `any`.
function toPageBlock(item: FixtureItem): PageBlock {
  return { id: item.id, type: item.type, props: item.props } as unknown as PageBlock;
}

export default function GenericCatalogFixture() {
  const [seed, setSeed] = useState<GenericSeedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const injected = typeof window !== "undefined" ? window.__GENERIC_SEED__ : undefined;
    if (!Array.isArray(injected) || injected.length === 0) {
      setError(
        "window.__GENERIC_SEED__ is missing or empty. This page is only " +
          "intended to be loaded by the Playwright no-Dandy-leak spec, which " +
          "injects the generic-tenant block_catalog seed before navigation.",
      );
      return;
    }
    setSeed(injected);
  }, []);

  if (error) {
    return (
      <div
        data-testid="fixture-error"
        style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#333" }}
      >
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Generic catalog fixture</h1>
        <p style={{ fontSize: 14, color: "#666" }}>{error}</p>
      </div>
    );
  }

  if (!seed) {
    return <div data-testid="fixture-loading">Loading generic catalog fixture…</div>;
  }

  const items = seed.map(buildItem);

  return (
    <div data-testid="generic-catalog-fixture" data-seed-count={items.length}>
      <Suspense fallback={null}>
        {items.map((item) => (
          <section
            key={item.id}
            data-fixture-block={item.type}
            data-has-registry-def={item.hasRegistryDef ? "1" : "0"}
          >
            <BlockErrorBoundary blockType={item.type}>
              <BlockRenderer block={toPageBlock(item)} brand={DEFAULT_BRAND} />
            </BlockErrorBoundary>
          </section>
        ))}
      </Suspense>
      {/* Sentinel for the Playwright spec to await before scanning. */}
      <div data-testid="fixture-ready" style={{ height: 1, width: 1, opacity: 0 }} />
    </div>
  );
}
