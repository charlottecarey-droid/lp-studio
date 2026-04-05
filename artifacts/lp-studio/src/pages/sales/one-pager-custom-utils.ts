export type { OverlayField, CustomTemplate } from "@workspace/one-pager-types";
export { TEMPLATE_VISIBILITY_KEY, DELETED_BUILTINS_KEY } from "@workspace/one-pager-types";
export { svgToPng, hexToRgb, loadImg, generateCustomTemplatePdf } from "@workspace/one-pager-types/pdf";
import type { OverlayField, CustomTemplate } from "@workspace/one-pager-types";

const API_BASE = "/api";

// ── API helpers ───────────────────────────────────────────────────────

export async function apiLoadLayoutDefault(key: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`);
    if (res.ok) {
      const d = await res.json();
      if (d) { localStorage.setItem(`lp_studio_${key}`, JSON.stringify(d)); return d; }
    }
  } catch {}
  try { const r = localStorage.getItem(`lp_studio_${key}`); return r ? JSON.parse(r) : null; } catch { return null; }
}

export async function apiSaveLayoutDefault(key: string, config: Record<string, unknown>): Promise<void> {
  try { localStorage.setItem(`lp_studio_${key}`, JSON.stringify(config)); } catch {}
  try {
    await fetch(`${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }),
    });
  } catch {}
}

export async function fetchCustomTemplates(): Promise<CustomTemplate[]> {
  const res = await fetch(`${API_BASE}/sales/one-pager-templates`);
  if (!res.ok) throw new Error("Failed to load templates");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(t => ({
    ...(t as object),
    background_url: (t.backgroundUrl as string) ?? (t.background_url as string) ?? "",
    headerHeight: (t.headerHeight as number) ?? (t.header_height as number) ?? 30,
    headerImageUrl: (t.headerImageUrl as string | undefined) ?? (t.header_image_url as string | undefined),
    isDeleted: (t.isDeleted as boolean) ?? (t.is_deleted as boolean) ?? false,
    fields: Array.isArray(t.fields) ? (t.fields as OverlayField[]) : [],
  } as CustomTemplate));
}

export async function saveCustomTemplate(tpl: CustomTemplate): Promise<CustomTemplate> {
  const payload = {
    name: tpl.name,
    background_url: tpl.background_url,
    orientation: tpl.orientation,
    fields: tpl.fields,
    headerHeight: tpl.headerHeight ?? 30,
    headerImageUrl: tpl.headerImageUrl ?? null,
    isDeleted: tpl.isDeleted ?? false,
  };
  const url = tpl.id
    ? `${API_BASE}/sales/one-pager-templates/${tpl.id}`
    : `${API_BASE}/sales/one-pager-templates`;
  const method = tpl.id ? "PATCH" : "POST";
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Save failed");
  const d = await res.json() as Record<string, unknown>;
  return {
    ...(d as object),
    background_url: (d.backgroundUrl as string) ?? (d.background_url as string) ?? "",
    headerHeight: (d.headerHeight as number) ?? (d.header_height as number) ?? 30,
    headerImageUrl: (d.headerImageUrl as string | undefined) ?? (d.header_image_url as string | undefined),
    fields: Array.isArray(d.fields) ? (d.fields as OverlayField[]) : [],
  } as CustomTemplate;
}

export async function deleteCustomTemplate(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/sales/one-pager-templates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}
