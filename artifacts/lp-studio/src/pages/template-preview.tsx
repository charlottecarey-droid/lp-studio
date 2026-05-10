import { useParams } from "wouter";
import { Suspense, useEffect, useState } from "react";
import { LP_TEMPLATES } from "@/lib/templates";
import { templateToBlocks } from "@/lib/block-types/block-registry";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { DEFAULT_BRAND, getBrandStyleVars, fetchBrandConfig, type BrandConfig } from "@/lib/brand-config";

export default function TemplatePreview() {
  const params = useParams<{ templateId: string }>();
  const templateId = params.templateId ?? "";
  const template = LP_TEMPLATES.find((t) => t.id === templateId);

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

  if (!template) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0A0A", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Template not found</div>
          <div style={{ opacity: 0.6 }}>No template with id "{templateId}".</div>
        </div>
      </div>
    );
  }

  const blocks = templateToBlocks(templateId);

  return (
    <Suspense fallback={null}>
      <div style={getBrandStyleVars(brand)}>
        {blocks.map((block, i) => (
          <BlockRenderer key={block.id ?? i} block={block as never} brand={brand} />
        ))}
      </div>
    </Suspense>
  );
}
