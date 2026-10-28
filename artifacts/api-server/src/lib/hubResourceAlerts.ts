/**
 * Content Hub — Slack alert when an IDENTIFIED person opens or downloads a
 * resource (phase 3, Oct 2026). Fires from the asset beacon, fire-and-forget:
 *
 *   1. the event is a resource action (view / open / download) and can be
 *      attributed to a lead — the gate's lead id stamped on the row, or the
 *      lead whose form submit shares the event's tracking session;
 *   2. the block that owns the resource has `gate.alertSlack` on (set in the
 *      builder's Resource gate section);
 *   3. the tenant has a connected Slack channel;
 *   4. nothing was posted for the same person + resource in the last 24h.
 *
 * Never throws — the beacon route must answer 204 whatever happens here.
 */
import { db, lpLeadsTable, lpPagesTable, tenantsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { slackService } from "./slack-service";
import { blockWantsSlackAlert } from "./hubResourceAlertRules";

export { blockWantsSlackAlert };

export interface HubAlertInput {
  tenantId: number;
  pageId: number;
  blockId: string | null;
  assetKey: string;
  assetTitle: string | null;
  assetKind: string;
  action: string;
  sessionId: string;
  leadId: number | null;
}

export async function maybeAlertHubResource(input: HubAlertInput): Promise<void> {
  try {
    if (!["view", "open", "download"].includes(input.action)) return;
    // Attribution: stamped lead, else the lead that owns this tracking session.
    let leadId = input.leadId;
    if (!leadId) {
      const [bySession] = await db
        .select({ id: lpLeadsTable.id })
        .from(lpLeadsTable)
        .where(and(eq(lpLeadsTable.tenantId, input.tenantId), eq(lpLeadsTable.sessionId, input.sessionId)))
        .orderBy(sql`${lpLeadsTable.createdAt} DESC`)
        .limit(1);
      leadId = bySession?.id ?? null;
    }
    if (!leadId) return;

    const [page] = await db
      .select({ title: lpPagesTable.title, slug: lpPagesTable.slug, blocks: lpPagesTable.blocks })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.id, input.pageId))
      .limit(1);
    if (!page || !blockWantsSlackAlert(page.blocks, input.blockId)) return;

    const conn = await slackService.getActiveConnection(input.tenantId);
    if (!conn) return;

    // Dedupe: one post per person + resource per 24h (count prior attributed events).
    const [prior] = (await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM lp_asset_events
      WHERE tenant_id = ${input.tenantId} AND asset_key = ${input.assetKey} AND action IN ('view','open','download')
        AND created_at >= now() - interval '24 hours'
        AND (lead_id = ${leadId} OR (lead_id IS NULL AND session_id = ${input.sessionId}))
    `)).rows as Array<{ n: number }>;
    if ((prior?.n ?? 0) > 1) return; // the row just inserted counts as 1

    const [lead] = (await db.execute(sql`
      SELECT fields->>'email' AS email, NULLIF(TRIM(CONCAT_WS(' ', fields->>'firstName', fields->>'lastName')), '') AS name, fields->>'company' AS company
      FROM lp_leads WHERE id = ${leadId} AND tenant_id = ${input.tenantId}
    `)).rows as Array<{ email: string | null; name: string | null; company: string | null }>;
    if (!lead) return;
    const [{ n: resourcesSoFar }] = (await db.execute(sql`
      SELECT COUNT(DISTINCT asset_key)::int AS n FROM lp_asset_events
      WHERE tenant_id = ${input.tenantId} AND action IN ('view','open','download')
        AND (lead_id = ${leadId} OR (lead_id IS NULL AND session_id = ${input.sessionId}))
    `)).rows as Array<{ n: number }>;

    const [tenant] = await db
      .select({ domain: tenantsTable.domain, micrositeDomain: tenantsTable.micrositeDomain })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, input.tenantId))
      .limit(1);
    const pageUrl = tenant?.micrositeDomain
      ? `https://${tenant.micrositeDomain}/${page.slug}`
      : tenant?.domain
        ? `https://${tenant.domain}/lp/${page.slug}`
        : undefined;

    const msg = slackService.buildHubResourceBlocks({
      personName: lead.name,
      email: lead.email,
      company: lead.company,
      action: input.action as "view" | "open" | "download",
      assetTitle: input.assetTitle || input.assetKey,
      assetKind: input.assetKind,
      pageTitle: page.title,
      pageUrl,
      resourcesSoFar: resourcesSoFar ?? 1,
      at: new Date().toISOString(),
    });
    await slackService.postMessage(input.tenantId, msg).catch(() => {});
  } catch (err) {
    console.warn("[hub] Slack resource alert skipped:", err);
  }
}
