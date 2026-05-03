import { useParams } from "wouter";
import { Suspense } from "react";
import { LP_TEMPLATES } from "@/lib/templates";
import { templateToBlocks } from "@/lib/block-types/block-registry";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { DEFAULT_BRAND, getBrandStyleVars } from "@/lib/brand-config";

export default function TemplatePreview() {
  const params = useParams<{ templateId: string }>();
  const templateId = params.templateId ?? "";
  const template = LP_TEMPLATES.find((t) => t.id === templateId);

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
      <div style={getBrandStyleVars(DEFAULT_BRAND)}>
        {blocks.map((block, i) => (
          <BlockRenderer key={block.id ?? i} block={block as never} brand={DEFAULT_BRAND} />
        ))}
      </div>
    </Suspense>
  );
}
