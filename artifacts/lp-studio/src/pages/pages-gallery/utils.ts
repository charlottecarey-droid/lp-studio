import { LP_TEMPLATES } from "@/lib/templates";
import { MICROSITE_TEMPLATES } from "@/lib/microsite-templates";
import { templateToBlocks, type PageBlock } from "@/lib/block-types";

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Count `custom-schema` block instances on a page that are linked to a
// shared/global master (have a `customBlockId`). Master block edits flow
// into every linked instance via the CustomBlocksProvider lookup, so the
// page list surfaces this so authors understand why their page can change
// without a direct page edit (task #201). Walks nested container children.
export function countLinkedGlobalBlocks(blocks: PageBlock[] | undefined): number {
  if (!blocks || blocks.length === 0) return 0;
  let count = 0;
  for (const b of blocks) {
    if (
      b.type === "custom-schema" &&
      typeof (b.props as { customBlockId?: number } | undefined)?.customBlockId === "number"
    ) {
      count += 1;
    }
    if (b.children && b.children.length > 0) {
      count += countLinkedGlobalBlocks(b.children);
    }
  }
  return count;
}

// "blank" is always first; dental-only built-in templates are appended at
// render time when the tenant's industry is "dental". Generic tenants get
// their starting templates from the API (industry-filtered global templates),
// so they never see hardcoded Dandy/dental copy.
export const BLANK_OPTION = { id: "blank", name: "Blank Canvas", description: "Start from scratch with an empty page" };
export const DENTAL_BUILTIN_OPTIONS = LP_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description }));

export function getTemplateBlocks(templateId: string): PageBlock[] {
  if (templateId === "blank") return [];
  if (templateId.startsWith("microsite-")) {
    const tpl = MICROSITE_TEMPLATES.find(t => t.id === templateId);
    return tpl ? tpl.buildBlocks() : [];
  }
  return templateToBlocks(templateId);
}

// Audience gating for the create-page dialog. When the selected segment
// resolves to a practice audience, we hide leadership-only templates.
export function inferAudienceType(segName: string): string | null {
  const n = segName.toLowerCase();
  if (n.includes("dso") && (n.includes("corporate") || n.includes("leadership") || n.includes("executive") || n.includes("c-suite"))) return "dso-corporate";
  if (n.includes("dso") && (n.includes("practice") || n.includes("office") || n.includes("dentist"))) return "dso-practice";
  if (n.includes("independent") || n.includes("solo") || n.includes("private")) return "independent";
  if (n.includes("dso")) return "dso-corporate";
  if (n.includes("practice")) return "dso-practice";
  return null;
}
