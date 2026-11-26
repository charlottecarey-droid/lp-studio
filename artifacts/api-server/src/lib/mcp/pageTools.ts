/**
 * Claude connector — page editing tools (scope lpstudio:pages).
 *
 * Like every connector tool these call LP Studio's own routes as the rep
 * (dispatch.ts), so permissions, the review/publish gate, the stale-save guard
 * and the prerender cache all behave exactly as in the builder.
 *
 * Every content save is versioned by the server (lib/pageVersions.ts), so any
 * change made here can be undone with restore_page_version.
 */
import { z } from "zod";
import { SCOPE_PAGES } from "./oauthStore";
import { call, links, pick, qs, ToolError, type ToolContext, type ToolDef } from "./toolKit";
import { pageExtrasTools, pageLocation } from "./pageExtras";

type Row = Record<string, unknown>;
interface Block {
  id?: string;
  type?: string;
  props?: Row;
  blockSettings?: Row;
  children?: Block[];
  [k: string]: unknown;
}

/* ── block helpers ──────────────────────────────────────────────────────── */

/** Depth-first walk over a block tree (containers keep nested blocks in `children`). */
export function* walkBlocks(blocks: unknown, depth = 0, parentId: string | null = null): Generator<{ block: Block; depth: number; parentId: string | null; index: number }> {
  if (!Array.isArray(blocks)) return;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i] as Block;
    if (!b || typeof b !== "object") continue;
    yield { block: b, depth, parentId, index: i };
    if (Array.isArray(b.children)) yield* walkBlocks(b.children, depth + 1, typeof b.id === "string" ? b.id : null);
  }
}

export function findBlock(blocks: unknown, id: string): Block | null {
  for (const { block } of walkBlocks(blocks)) if (block.id === id) return block;
  return null;
}

/** First few human-readable strings in a block's props, for an outline. */
function textPreview(props: unknown, max = 160): string {
  const out: string[] = [];
  const visit = (v: unknown, key: string, depth: number) => {
    if (out.join(" · ").length >= max || depth > 4) return;
    if (typeof v === "string") {
      const t = v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (t && t.length > 2 && !/^(https?:|\/|#|data:|rgba?\(|var\()/i.test(t) && !/(url|src|image|icon|color|href|id|style|class|variant|layout)$/i.test(key)) out.push(t);
    } else if (Array.isArray(v)) v.slice(0, 3).forEach((x) => visit(x, key, depth + 1));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Row)) visit(x, k, depth + 1);
  };
  visit(props, "", 0);
  const s = out.join(" · ");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function outlineOf(blocks: unknown) {
  return [...walkBlocks(blocks)].map(({ block, depth, parentId }) => ({
    id: block.id,
    type: block.type,
    depth,
    ...(parentId ? { parentId } : {}),
    ...(Array.isArray(block.children) && block.children.length ? { children: block.children.length } : {}),
    sizeKb: Math.round(JSON.stringify(block).length / 102.4) / 10,
    text: textPreview(block.props),
  }));
}

/** Plain-object deep merge: objects merge key by key, everything else (arrays included) is replaced. */
export function deepMerge(base: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch;
  if (!base || typeof base !== "object" || Array.isArray(base)) return patch;
  const out: Row = { ...(base as Row) };
  for (const [k, v] of Object.entries(patch as Row)) {
    out[k] = v === null ? null : deepMerge((base as Row)[k], v);
  }
  return out;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "page";
}

/* ── page I/O ───────────────────────────────────────────────────────────── */

async function loadPage(ctx: ToolContext, pageId: number): Promise<Row> {
  return (await call(ctx, "GET", `/lp/pages/${pageId}`)) as Row;
}

/** Explain the save errors a model can act on. */
function saveError(err: unknown): never {
  if (err instanceof ToolError) {
    const body = (err.body ?? {}) as Row;
    if (err.status === 409 && body.code === "page_changed") {
      throw new ToolError(`The page changed since you read it (last saved by ${body.updatedBy ?? "someone"} at ${body.updatedAt ?? "?"}). Call get_page again and redo the edit on the current version.`);
    }
    if (err.status === 409 && body.code === "fact_flags_pending") {
      throw new ToolError(`Publishing is waiting on fact review: ${String(body.error ?? "this page has unreviewed facts")}. Review them in the builder (Review Facts), then publish.`);
    }
  }
  throw err;
}

async function savePage(ctx: ToolContext, pageId: number, body: Row): Promise<Row> {
  try {
    return (await call(ctx, "PUT", `/lp/pages/${pageId}`, body, 60_000)) as Row;
  } catch (err) {
    saveError(err);
  }
}

const pageHeader = async (ctx: ToolContext, p: Row) => ({
  ...pick(p, ["id", "title", "slug", "status", "mode", "accountId", "isTemplate", "updatedAt", "updatedBy", "createdBy", "metaTitle", "metaDescription", "ogImage"]),
  blocksVersion: p.blocksVersion,
  ...(await pageLocation(ctx, p)),
  editLink: links(ctx).page(p.id),
});

const id = () => z.number().int().positive();
const note = () => z.string().max(500).optional().describe("One-line changelog note for this change, e.g. 'v3b: shorter hero headline'. Shows in the page's version history.");

/* ── tools ──────────────────────────────────────────────────────────────── */

const CORE_TOOLS: ToolDef[] = [
  {
    name: "get_page",
    title: "Get a page",
    description:
      "Read one page: title, slug, status, SEO fields, where it is live (URL, custom domain), preview link, and its blocks in LP Studio's block format ({id, type, props, blockSettings?, children?}). " +
      "view='outline' (good first call on big pages) lists every block's id, type, nesting and a text preview without the full props; view='blocks' returns full blocks for the given blockIds only; view='full' (default) returns everything. " +
      "Keep blocksVersion: update_page needs it when you send blocks.",
    scope: SCOPE_PAGES,
    readOnly: true,
    input: {
      pageId: id(),
      view: z.enum(["full", "outline", "blocks"]).optional(),
      blockIds: z.array(z.string().max(120)).max(50).optional().describe("With view='blocks': which blocks to return."),
    },
    run: async (ctx, args) => {
      const p = await loadPage(ctx, Number(args.pageId));
      const view = String(args.view ?? "full");
      const blocks = Array.isArray(p.blocks) ? (p.blocks as Block[]) : [];
      const head = await pageHeader(ctx, p);
      const extras = pick(p, ["customCss", "pageVariables", "ctaDefault", "styleOverrides", "animationsEnabled", "smoothScroll", "showCookieBanner"]);
      if (view === "outline") return { ...head, blockCount: blocks.length, sizeKb: Math.round(JSON.stringify(blocks).length / 1024), outline: outlineOf(blocks) };
      if (view === "blocks") {
        const ids = (args.blockIds as string[] | undefined) ?? [];
        if (!ids.length) throw new ToolError("Give blockIds with view='blocks' (get them from view='outline').");
        const found = ids.map((bid) => findBlock(blocks, bid));
        return { ...head, blocks: found.filter(Boolean), missing: ids.filter((_, i) => !found[i]) };
      }
      return { ...head, ...extras, blocks };
    },
  },
  {
    name: "update_page",
    title: "Update a page",
    description:
      "Save changes to a page. Send only the fields you're changing. blocks REPLACES the whole block list (same format get_page returns) and needs blocksVersion from your last get_page/update; for a change to one block use update_block instead. " +
      "Does not change publish status (use publish_page / unpublish_page). If the page is published, the live page updates immediately. Each save is versioned; restore_page_version undoes it.",
    scope: SCOPE_PAGES,
    readOnly: false,
    input: {
      pageId: id(),
      blocks: z.array(z.record(z.string(), z.unknown())).max(1000).optional(),
      blocksVersion: z.string().max(64).optional().describe("From get_page; required when sending blocks. Protects against overwriting someone else's newer edit."),
      title: z.string().min(1).max(300).optional(),
      slug: z.string().min(1).max(255).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/).optional().describe("Changing the slug of a live page changes its URL."),
      metaTitle: z.string().max(300).optional(),
      metaDescription: z.string().max(1000).optional(),
      ogImage: z.string().max(2000).optional(),
      customCss: z.string().max(200_000).optional(),
      pageVariables: z.record(z.string(), z.string()).optional(),
      ctaDefault: z.record(z.string(), z.unknown()).nullable().optional().describe("Page-level default CTA (CtaConfig, see list_block_types), or null to clear."),
      note: note(),
    },
    run: async (ctx, args) => {
      const pageId = Number(args.pageId);
      if (args.blocks !== undefined && !args.blocksVersion) throw new ToolError("Sending blocks needs blocksVersion from get_page, so a newer edit isn't overwritten. Call get_page first.");
      const body: Row = pick(args as Row, ["title", "slug", "metaTitle", "metaDescription", "ogImage", "customCss", "pageVariables"]);
      if (args.ctaDefault !== undefined) body.ctaDefault = args.ctaDefault;
      if (args.blocks !== undefined) {
        body.blocks = args.blocks;
        body.baseBlocksVersion = args.blocksVersion;
      }
      if (!Object.keys(body).length) throw new ToolError("Nothing to change: send at least one field.");
      if (args.note) body.versionNote = args.note;
      const saved = await savePage(ctx, pageId, body);
      return { saved: true, ...(await pageHeader(ctx, saved)), blockCount: Array.isArray(saved.blocks) ? saved.blocks.length : undefined };
    },
  },
  {
    name: "update_block",
    title: "Update one block",
    description:
      "Change one block on a page without resending the page. props are deep-merged into the block's props by default (objects merge key by key; arrays and strings are replaced; null clears a key). " +
      "Set replaceProps to replace props entirely. blockSettings (spacing, background, visibility) merge the same way. Find block ids with get_page view='outline'. Live pages update immediately; versioned like every save.",
    scope: SCOPE_PAGES,
    readOnly: false,
    input: {
      pageId: id(),
      blockId: z.string().min(1).max(120),
      props: z.record(z.string(), z.unknown()).optional(),
      blockSettings: z.record(z.string(), z.unknown()).optional(),
      replaceProps: z.boolean().optional(),
      note: note(),
    },
    run: async (ctx, args) => {
      const pageId = Number(args.pageId);
      if (!args.props && !args.blockSettings) throw new ToolError("Send props and/or blockSettings to change.");
      // Read-modify-write guarded by the fingerprint we just read: if someone
      // saves in between, the server refuses and we retry once on fresh data.
      for (let attempt = 0; attempt < 2; attempt++) {
        const p = await loadPage(ctx, pageId);
        const blocks = structuredClone(Array.isArray(p.blocks) ? p.blocks : []) as Block[];
        const block = findBlock(blocks, String(args.blockId));
        if (!block) throw new ToolError(`No block with id '${args.blockId}' on page ${pageId}. Call get_page with view='outline' for ids.`);
        if (args.props) block.props = (args.replaceProps ? args.props : deepMerge(block.props ?? {}, args.props)) as Row;
        if (args.blockSettings) block.blockSettings = deepMerge(block.blockSettings ?? {}, args.blockSettings) as Row;
        try {
          const saved = (await call(ctx, "PUT", `/lp/pages/${pageId}`, { blocks, baseBlocksVersion: p.blocksVersion, ...(args.note ? { versionNote: args.note } : {}) }, 60_000)) as Row;
          return { saved: true, block: findBlock(saved.blocks, String(args.blockId)), ...(await pageHeader(ctx, saved)) };
        } catch (err) {
          if (attempt === 0 && err instanceof ToolError && err.status === 409 && (err.body as Row | undefined)?.code === "page_changed") continue;
          saveError(err);
        }
      }
      throw new ToolError("The page kept changing while saving. Try again.");
    },
  },
  {
    name: "create_page",
    title: "Create a page",
    description:
      "Create a new DRAFT page, not tied to an account. Start empty, from blocks you provide, or from a template (fromTemplateId). Slug defaults to one made from the title. To copy an existing page use duplicate_page.",
    scope: SCOPE_PAGES,
    readOnly: false,
    input: {
      title: z.string().min(1).max(300),
      slug: z.string().min(1).max(255).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/).optional(),
      blocks: z.array(z.record(z.string(), z.unknown())).max(1000).optional(),
      fromTemplateId: id().optional(),
      metaTitle: z.string().max(300).optional(),
      metaDescription: z.string().max(1000).optional(),
      customCss: z.string().max(200_000).optional(),
    },
    run: async (ctx, args) => {
      const base = String(args.slug ?? slugify(String(args.title)));
      let lastErr: unknown;
      for (let n = 1; n <= 5; n++) {
        const slug = n === 1 ? base : `${base}-${n}`;
        try {
          const page = (await call(ctx, "POST", "/lp/pages", { ...pick(args as Row, ["title", "blocks", "fromTemplateId", "metaTitle", "metaDescription", "customCss"]), slug, status: "draft" })) as Row;
          return { created: true, ...(await pageHeader(ctx, page)) };
        } catch (err) {
          lastErr = err;
          // Slug taken: only auto-suffix when the caller didn't ask for a specific slug.
          if (!(err instanceof ToolError && err.status === 409) || args.slug) break;
        }
      }
      throw lastErr;
    },
  },
  {
    name: "duplicate_page",
    title: "Duplicate a page",
    description:
      "Copy a page (blocks, CSS, SEO, variables) into a new DRAFT, e.g. to make versions 3b and 3c. Give a title and slug for the copy, or they default to 'Copy of …' and '<slug>-copy'. Pass accountId to tie the copy to an account (the account name is swapped into the copy).",
    scope: SCOPE_PAGES,
    readOnly: false,
    input: {
      pageId: id(),
      title: z.string().min(1).max(300).optional(),
      slug: z.string().min(1).max(255).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/).optional(),
      accountId: id().optional(),
    },
    run: async (ctx, args) => {
      const page = (await call(ctx, "POST", `/lp/pages/${Number(args.pageId)}/clone`, pick(args as Row, ["title", "slug", "accountId"]))) as Row;
      return {
        created: true,
        copiedFrom: Number(args.pageId),
        ...(await pageHeader(ctx, page)),
        ...(args.slug && page.slug !== args.slug ? { note: `Slug '${args.slug}' was taken, so the copy is at '${page.slug}'.` } : {}),
      };
    },
  },

  /* ── versions ── */

  {
    name: "list_page_versions",
    title: "List page versions",
    description:
      "A page's version history, newest first: when, who, why (save, checkpoint, publish, unpublish, restore, delete) and the changelog note. Each version is the page as it was BEFORE that change. Restore one with restore_page_version.",
    scope: SCOPE_PAGES,
    readOnly: true,
    input: { pageId: id(), limit: z.number().int().min(1).max(200).optional() },
    run: async (ctx, args) => call(ctx, "GET", `/lp/pages/${Number(args.pageId)}/versions${qs({ limit: Number(args.limit ?? 30) })}`),
  },
  {
    name: "get_page_version",
    title: "Get a page version",
    description: "One saved version: its metadata and, with includeBlocks, the full content (blocks, CSS, SEO) as it was. Use it to compare with the current page before restoring.",
    scope: SCOPE_PAGES,
    readOnly: true,
    input: { versionId: id(), includeBlocks: z.boolean().optional() },
    run: async (ctx, args) => {
      const v = (await call(ctx, "GET", `/lp/page-versions/${Number(args.versionId)}`)) as Row;
      const snap = (v.snapshot ?? {}) as Row;
      if (args.includeBlocks) return v;
      const { blocks, ...rest } = snap;
      return { ...v, snapshot: { ...rest, outline: outlineOf(blocks) } };
    },
  },
  {
    name: "checkpoint_page",
    title: "Save a checkpoint",
    description: "Save the page's current state as a named version, e.g. before a risky edit ('Before Chili Piper changes'). Restore it later with restore_page_version.",
    scope: SCOPE_PAGES,
    readOnly: false,
    input: { pageId: id(), note: z.string().min(1).max(500) },
    run: async (ctx, args) => call(ctx, "POST", `/lp/pages/${Number(args.pageId)}/checkpoint`, { note: args.note }),
  },
  {
    name: "restore_page_version",
    title: "Restore a page version",
    description:
      "Put a saved version's content back on its page (blocks, title, CSS, SEO, variables). The current content is saved as a version first, so this can be undone. Slug and publish status are kept, so a live page stays live with the restored content. " +
      "For a deleted page (see list_deleted_pages) this brings it back as a draft with a new page id.",
    scope: SCOPE_PAGES,
    readOnly: false,
    destructive: true,
    input: { versionId: id(), note: note() },
    run: async (ctx, args) => {
      const res = (await call(ctx, "POST", `/lp/page-versions/${Number(args.versionId)}/restore`, args.note ? { note: args.note } : {})) as Row;
      const page = (res.page ?? {}) as Row;
      return { ...res, ...(page.id ? { editLink: links(ctx).page(page.id) } : {}) };
    },
  },
  {
    name: "list_deleted_pages",
    title: "List deleted pages",
    description: "Pages deleted in the last N days (default 90) that can be brought back with restore_page_version (pass the versionId shown).",
    scope: SCOPE_PAGES,
    readOnly: true,
    input: { days: z.number().int().min(1).max(365).optional() },
    run: async (ctx, args) => call(ctx, "GET", `/lp/pages/deleted${qs({ days: Number(args.days ?? 90) })}`),
  },

  /* ── publishing ── */

  {
    name: "publish_page",
    title: "Publish a page",
    description:
      "Publish a page so it's live on the web. ONLY call this after the rep has clearly said to publish this specific page in this conversation, and pass confirm: true. Fails if the rep can't publish (review required) or facts are waiting on review. Returns the live URL.",
    scope: SCOPE_PAGES,
    readOnly: false,
    destructive: true,
    input: { pageId: id(), confirm: z.literal(true).describe("Must be true: the rep explicitly asked to publish."), note: note() },
    run: async (ctx, args) => {
      if (args.confirm !== true) throw new ToolError("Ask the rep to confirm publishing first, then call again with confirm: true.");
      const saved = await savePage(ctx, Number(args.pageId), { status: "published", ...(args.note ? { versionNote: args.note } : {}) });
      return { published: saved.status === "published", ...(await pageHeader(ctx, saved)) };
    },
  },
  {
    name: "unpublish_page",
    title: "Unpublish a page",
    description:
      "Take a live page offline (back to draft); its URL stops working. ONLY call this after the rep has clearly said to unpublish this specific page, and pass confirm: true.",
    scope: SCOPE_PAGES,
    readOnly: false,
    destructive: true,
    input: { pageId: id(), confirm: z.literal(true).describe("Must be true: the rep explicitly asked to unpublish."), note: note() },
    run: async (ctx, args) => {
      if (args.confirm !== true) throw new ToolError("Ask the rep to confirm unpublishing first, then call again with confirm: true.");
      const saved = await savePage(ctx, Number(args.pageId), { status: "draft", ...(args.note ? { versionNote: args.note } : {}) });
      return { unpublished: saved.status !== "published", ...(await pageHeader(ctx, saved)) };
    },
  },
];

export const PAGE_TOOLS: ToolDef[] = [...CORE_TOOLS, ...pageExtrasTools];
