/**
 * Content Hub asset beacon — body validation (pure, unit-tested).
 *
 * The hub-library / hub-featured blocks POST one event per visitor action on
 * a resource. Hand-validated (like the dwell beacon) rather than api-zod: the
 * payload is seven small fields, public, and may arrive via sendBeacon.
 */
/** Resource actions, plus phase-3 signals: `progress` (video milestone), `time`
 *  (seconds the viewer stayed open) and the hub-level `search` / `section` /
 *  `audience` interactions (kind "hub", synthetic asset keys). */
export const ASSET_EVENT_ACTIONS = new Set(["seen", "view", "open", "download", "progress", "time", "search", "section", "audience"]);
export const ASSET_EVENT_KINDS = new Set(["pdf", "video", "link", "image", "text", "hub"]);
/** Actions that count as "engaged with a resource" in the funnel. */
export const RESOURCE_ACTIONS = ["view", "open", "download"] as const;

export interface AssetEventInput {
  pageId: number;
  sessionId: string;
  blockId: string | null;
  assetKey: string;
  assetTitle: string | null;
  assetKind: string;
  action: string;
  leadId: number | null;
  value: number | null;
  detail: string | null;
}

export function parseAssetEventBody(raw: unknown): AssetEventInput | null {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pageId = typeof body.pageId === "number" ? Math.floor(body.pageId) : NaN;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const assetKey = typeof body.assetKey === "string" ? body.assetKey.trim().slice(0, 120) : "";
  const assetKind = typeof body.assetKind === "string" ? body.assetKind.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const blockId = typeof body.blockId === "string" && body.blockId.trim() ? body.blockId.trim().slice(0, 120) : null;
  const assetTitle = typeof body.assetTitle === "string" && body.assetTitle.trim() ? body.assetTitle.trim().slice(0, 200) : null;
  if (!Number.isFinite(pageId) || pageId <= 0) return null;
  if (!sessionId || sessionId.length > 128) return null;
  if (!assetKey) return null;
  if (!ASSET_EVENT_KINDS.has(assetKind) || !ASSET_EVENT_ACTIONS.has(action)) return null;
  const leadId = typeof body.leadId === "number" && Number.isFinite(body.leadId) && body.leadId > 0 ? Math.floor(body.leadId) : null;
  const value = typeof body.value === "number" && Number.isFinite(body.value) && body.value >= 0 ? Math.min(Math.floor(body.value), 1_000_000) : null;
  const detail = typeof body.detail === "string" && body.detail.trim() ? body.detail.trim().slice(0, 200) : null;
  return { pageId, sessionId, blockId, assetKey, assetTitle, assetKind, action, leadId, value, detail };
}
