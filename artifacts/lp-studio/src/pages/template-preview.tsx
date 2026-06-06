import { useParams } from "wouter";
import { Suspense, useEffect, useState } from "react";
import { LP_TEMPLATES, parseGlobalTemplateId } from "@/lib/templates";
import { templateToBlocks } from "@/lib/block-types/block-registry";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { DEFAULT_BRAND, getBrandStyleVars, fetchBrandConfig, type BrandConfig } from "@/lib/brand-config";

const API_BASE = `${import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}/api`;

export default function TemplatePreview() {
  const params = useParams<{ templateId: string }>();
  // Featured cards encode the id (e.g. `global:3828` → `global%3A3828`) so the
  // colon survives as a single path segment. wouter does not decode route
  // params, so decode here before parsing — otherwise `global%3A3828` never
  // matches the `global:` prefix and the page falls back to "Template not
  // found". decodeURIComponent is a no-op for plain flagship slugs.
  const rawTemplateId = params.templateId ?? "";
  let templateId = rawTemplateId;
  try {
    templateId = decodeURIComponent(rawTemplateId);
  } catch {
    templateId = rawTemplateId;
  }
  const template = LP_TEMPLATES.find((t) => t.id === templateId);
  // A featured card can point at a DB-backed global template (`global:<id>`)
  // instead of a built-in flagship one. Those blocks aren't bundled here, so we
  // fetch them from the public preview endpoint (global templates only).
  const globalDbId = parseGlobalTemplateId(templateId);

  // Render with the tenant's brand so blocks reading var(--brand-primary)
  // etc. resolve to the tenant's actual palette (matching the builder).
  // Falls back to DEFAULT_BRAND until the /api/lp/brand fetch resolves.
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  useEffect(() => {
    let cancelled = false;
    fetchBrandConfig()
      .then(b => { if (!cancelled) setBrand(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Blocks for a DB-backed global template, fetched on demand. `null` = not
  // loaded yet, `[]` (with notFound) = the id didn't resolve.
  const [globalBlocks, setGlobalBlocks] = useState<unknown[] | null>(null);
  const [globalNotFound, setGlobalNotFound] = useState(false);
  useEffect(() => {
    if (globalDbId === null) return;
    let cancelled = false;
    setGlobalBlocks(null);
    setGlobalNotFound(false);
    fetch(`${API_BASE}/lp/global-templates/${globalDbId}/preview`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ blocks: unknown[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setGlobalBlocks(Array.isArray(data.blocks) ? data.blocks : []);
      })
      .catch(() => {
        if (!cancelled) { setGlobalNotFound(true); setGlobalBlocks([]); }
      });
    return () => { cancelled = true; };
  }, [globalDbId]);

  // Resolve the blocks to render: built-in flagship template, or the fetched
  // DB-backed global template.
  let blocks: unknown[] | null = null;
  if (template) {
    blocks = templateToBlocks(templateId) as unknown[];
  } else if (globalDbId !== null) {
    blocks = globalBlocks; // null while loading
  }

  // Unknown id (neither a built-in template nor a valid global ref) or a global
  // ref that failed to resolve → not-found screen.
  const notFound = (!template && globalDbId === null) || globalNotFound;
  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0A0A", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Template not found</div>
          <div style={{ opacity: 0.6 }}>No template with id "{templateId}".</div>
        </div>
      </div>
    );
  }

  // DB-backed global template still loading.
  if (blocks === null) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0A0A", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ opacity: 0.5 }}>Loading preview…</div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <div style={getBrandStyleVars(brand)}>
        {blocks.map((block, i) => (
          <BlockRenderer key={(block as { id?: string }).id ?? i} block={block as never} brand={brand} />
        ))}
      </div>
    </Suspense>
  );
}
