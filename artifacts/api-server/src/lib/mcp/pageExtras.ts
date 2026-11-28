/**
 * Claude connector — page support tools (scope lpstudio:pages): where a page
 * is live, preview links and screenshots, the media library, brand settings
 * and the block catalog.
 */
import { z } from "zod";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import { DEFAULT_BLOCK_TAGS } from "@workspace/lp-template-engine";
import { SCOPE_PAGES } from "./oauthStore";
import { call, pick, qs, RichResult, ToolError, type ToolContext, type ToolDef } from "./toolKit";
import { ensurePreviewReviewToken, resolvePreviewBaseUrl } from "../captureTemplateThumbnail";
import { capturePageScreenshot } from "../pageScreenshot";
import { WILDCARD_BASE_HOSTS } from "../tenantHosts";
import { STABLE_FONT_FILES } from "../../routes/lp/fonts";

type Row = Record<string, unknown>;

/* ── where a page lives ─────────────────────────────────────────────────── */

/**
 * Public address(es) of a page, same rule as the app's getLpPageUrl: the
 * microsite domain (e.g. ent.meetdandy.com/<slug>) wins, else the workspace
 * host's /lp/<slug>. `liveUrl` only when the page is published.
 */
export async function pageLocation(ctx: ToolContext, page: Row): Promise<Row> {
  const slug = String(page.slug ?? "");
  const tenantId = Number(page.tenantId ?? ctx.user.tenantId);
  const [tenant] = await db
    .select({ slug: tenantsTable.slug, domain: tenantsTable.domain, micrositeDomain: tenantsTable.micrositeDomain })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  const baseHost = WILDCARD_BASE_HOSTS.find((h) => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
  const workspace = tenant?.domain ? `https://${tenant.domain.toLowerCase()}` : baseHost && tenant?.slug ? `https://${tenant.slug.toLowerCase()}.${baseHost}` : ctx.origin;
  const publicUrl = tenant?.micrositeDomain ? `https://${tenant.micrositeDomain}/${slug}` : `${workspace}/lp/${slug}`;
  const isLive = page.status === "published";
  return {
    isLive,
    ...(isLive ? { liveUrl: publicUrl } : { urlWhenPublished: publicUrl }),
    ...(tenant?.micrositeDomain ? { customDomain: tenant.micrositeDomain } : {}),
    ...(tenant?.domain ? { workspaceDomain: tenant.domain } : {}),
  };
}

async function previewUrlFor(ctx: ToolContext, page: Row, opts: { forCapture?: boolean } = {}): Promise<string> {
  const token = await ensurePreviewReviewToken(Number(page.id));
  const host = new URL(ctx.origin).host;
  const base = opts.forCapture ? resolvePreviewBaseUrl(host) : ctx.origin;
  return `${base}/preview/${encodeURIComponent(String(page.slug))}?reviewToken=${token}${opts.forCapture ? "&prerender=1" : ""}`;
}

/* ── screenshots ────────────────────────────────────────────────────────── */

const WIDTHS = { desktop: { w: 1440, h: 900 }, tablet: { w: 820, h: 1180 }, mobile: { w: 390, h: 844 } } as const;
type Device = keyof typeof WIDTHS;
/** Claude reads images best under ~8000px tall and a few MB; full pages are cut into tiles. */
const MAX_TILE_HEIGHT = 2400;
const MAX_TILES = 6;

async function shoot(url: string, device: Device, fullPage: boolean): Promise<{ data: string; mimeType: string }[]> {
  const { w, h } = WIDTHS[device];
  const png = await capturePageScreenshot({ url, viewportWidth: w, viewportHeight: h, fullPage, timeoutMs: 90_000 });
  // Downscale wide captures so text stays legible without huge payloads.
  const targetWidth = device === "desktop" ? 1200 : w;
  const resized = sharp(png).resize({ width: targetWidth, withoutEnlargement: true });
  const { data, info } = await resized.toBuffer({ resolveWithObject: true });
  const tiles: { data: string; mimeType: string }[] = [];
  for (let top = 0; top < info.height && tiles.length < MAX_TILES; top += MAX_TILE_HEIGHT) {
    const height = Math.min(MAX_TILE_HEIGHT, info.height - top);
    const jpg = await sharp(data).extract({ left: 0, top, width: info.width, height }).jpeg({ quality: 78 }).toBuffer();
    tiles.push({ data: jpg.toString("base64"), mimeType: "image/jpeg" });
  }
  return tiles;
}

/* ── block catalog docs ─────────────────────────────────────────────────── */

const CTA_DOC = {
  where: "A page-level default CTA lives in the page's ctaDefault (update_page). Blocks with buttons resolve their CTA as block → page ctaDefault → workspace default.",
  CtaConfig: {
    label: "button text",
    action: "'url' | 'chilipiper' (Chili Piper popup) | 'modal-form' (email/lead form modal) | 'modal-chilipiper' (asks for email, then opens Chili Piper prefilled) | 'video-modal'",
    url: "link target when action is 'url'",
    chilipiper: "Chili Piper router URL for action 'chilipiper'",
    modalChilipiperUrl: "Chili Piper URL for 'modal-chilipiper' (the email is appended as ?email=)",
    videoUrl: "for 'video-modal'",
    videoPosterUrl: "poster image for 'video-modal'",
    buttonColor: "CSS color",
    buttonTextColor: "CSS color",
    secondary: "{ label, action, url, chilipiper, videoUrl } — optional second button",
    ctaStyle: "'buttons' | 'email-capture' (inline email field + button)",
    emailCapturePlaceholder: "placeholder for the inline email field",
    emailCaptureButtonText: "button text next to the inline email field",
    submitMode: "what the inline email field does: 'navigate' | 'modal-form' | 'modal-chilipiper'",
    modalFormSource: "'simple' | 'linked' (an LP Studio form, modalFormId) | 'marketo' (modalMarketoBaseUrl, modalMarketoMunchkinId, modalMarketoFormId)",
    modalChiliPiperHandoffUrl: "after the modal form submits, hand off to this Chili Piper URL",
    modalChiliPiperHandoffMode: "'modal' | 'redirect'",
    modalChiliPiperHandoffFieldMap: "form field → Chili Piper query param map",
    "modalHeadline / modalSubheadline / modalSubmitText / modalSuccessMessage / modalDisclaimer": "modal copy",
    "modalShowFirstName / modalShowLastName / modalShowPhone / modalShowCompany": "booleans: extra modal fields",
  },
  blockLevel: "Older blocks keep CTA fields in props (ctaText/ctaUrl/ctaAction/chilipiperUrl/cta1ChilipiperUrl); blockSettings.useCustomCta=true makes a block use its own CTA instead of the page default.",
};

const REPORT_READER_DOC = {
  props: "{ src: string (URL of the report document: https:// or a same-origin path such as /reports/<slug>/report.html), pdfUrl: string (optional PDF download link), title: string (toolbar title), view: 'auto' | 'magazine' | 'scroll' (auto = magazine on wide screens, scroll on narrow), allowViewToggle: boolean }",
  document: "The report is a normal HTML document. Each page is a <section class=\"page\"> designed at 816x1056 CSS px. The viewer adds rr-mag or rr-scroll to <html>, so the report can style fixed pages (html.rr-mag ...) and a reflowed reading layout (html.rr-scroll ...). Links with data-cp open the page's Chili Piper modal; data-form opens the lead form modal. It renders in the same sandbox as custom-html.",
};

const CUSTOM_HTML_DOC = {
  props: "{ html: string } — a snippet or a full HTML document, rendered in a sandboxed iframe (scripts, forms and popups allowed; no access to the parent page). Height auto-fits.",
  openNativeCta:
    "From inside the HTML, open LP Studio's own CTA modals with window.parent.postMessage({ __lpOpenCta: { mode, email } }, '*'). mode: 'chilipiper' (Chili Piper scheduler, prefilled with email; uses the page/workspace Chili Piper URL unless you pass url) | 'form' (the lead form modal) | 'cta' (whatever the page's default CTA does). Optional: url (Chili Piper URL), firstName, lastName.",
  fonts: "Brand font files have stable, CORS-open URLs (see get_brand → fonts.stableFiles); use those in @font-face, never /assets/… URLs, which change every release.",
};

const BLOCK_SETTINGS_DOC =
  "blockSettings (any block): spacing (paddingTop/paddingBottom), background colors/images, animation, anchorId (for #links), useCustomCta. Merge-able with update_block.";

/* ── tools ──────────────────────────────────────────────────────────────── */

export const pageExtrasTools: ToolDef[] = [
  {
    name: "get_preview_url",
    title: "Get a page preview link",
    description:
      "A link that shows the page as it currently is (drafts included) without signing in, for checking layout on any device, plus the live URL if published. The preview link works for anyone who has it, so share it only with people who should see the draft.",
    scope: SCOPE_PAGES,
    readOnly: true,
    input: { pageId: z.number().int().positive() },
    run: async (ctx, args) => {
      const page = (await call(ctx, "GET", `/lp/pages/${Number(args.pageId)}`)) as Row;
      return { pageId: page.id, title: page.title, status: page.status, previewUrl: await previewUrlFor(ctx, page), ...(await pageLocation(ctx, page)) };
    },
  },
  {
    name: "screenshot_page",
    title: "Screenshot a page",
    description:
      "Render the page's current saved content (drafts included) in a real browser and return screenshots: desktop (1440px), tablet (820px) and/or mobile (390px). fullPage captures the whole scroll, cut into tiles top to bottom. Takes 10-40 seconds per device.",
    scope: SCOPE_PAGES,
    readOnly: true,
    input: {
      pageId: z.number().int().positive(),
      devices: z.array(z.enum(["desktop", "tablet", "mobile"])).min(1).max(3).optional().describe("Default ['desktop','mobile']."),
      fullPage: z.boolean().optional().describe("Whole page instead of the first screen (default false)."),
    },
    run: async (ctx, args) => {
      const page = (await call(ctx, "GET", `/lp/pages/${Number(args.pageId)}`)) as Row;
      const url = await previewUrlFor(ctx, page, { forCapture: true });
      const devices = ((args.devices as Device[] | undefined) ?? ["desktop", "mobile"]).filter((d, i, a) => a.indexOf(d) === i);
      const images: { data: string; mimeType: string }[] = [];
      const shots: Row[] = [];
      for (const d of devices) {
        try {
          const tiles = await shoot(url, d, args.fullPage === true);
          shots.push({ device: d, width: WIDTHS[d].w, images: tiles.length });
          images.push(...tiles);
        } catch (err) {
          console.error(`[mcp] screenshot ${d} failed:`, err);
          shots.push({ device: d, error: "Couldn't capture this size. Try again, or use get_preview_url." });
        }
      }
      if (!images.length) throw new ToolError("Couldn't capture the page. Try again in a minute, or open get_preview_url in a browser.");
      return new RichResult({ pageId: page.id, title: page.title, status: page.status, fullPage: args.fullPage === true, shots, note: "Images follow in the order listed in shots (tiles top to bottom)." }, images);
    },
  },
  {
    name: "list_media",
    title: "Search the media library",
    description:
      "Find images (logos, photos, transparent PNGs…) or videos in the workspace media library. Images: search by title or tag (query), filter by tag (e.g. 'logo', 'partner', 'headshot'). Returns URLs ready to use in blocks.",
    scope: SCOPE_PAGES,
    readOnly: true,
    input: {
      mediaType: z.enum(["image", "video"]).optional().describe("Default image."),
      query: z.string().max(200).optional(),
      tag: z.string().max(80).optional(),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    run: async (ctx, args) => {
      if (args.mediaType === "video") {
        const res = (await call(ctx, "GET", "/lp/media?mediaType=video")) as { items?: Row[] };
        let items = res.items ?? [];
        const q = String(args.query ?? "").toLowerCase();
        if (q) items = items.filter((i) => String(i.title ?? "").toLowerCase().includes(q));
        return { total: items.length, items: items.slice(0, Number(args.limit ?? 40)).map((i) => pick(i, ["id", "title", "url", "mimeType", "sizeBytes", "createdAt"])) };
      }
      const res = (await call(ctx, "GET", `/lp/media/images${qs({ q: args.query as string, tag: args.tag as string, page: args.page as number, limit: Number(args.limit ?? 40) })}`)) as Row;
      const items = ((res.items as Row[] | undefined) ?? []).map((i) => {
        const tags = (i.tags as string[] | undefined) ?? [];
        return {
          ...pick(i, ["id", "title", "url", "mimeType", "sizeBytes", "width", "height", "createdAt"]),
          tags,
          ...(String(i.mimeType ?? "").match(/png|svg|webp/) ? { mayBeTransparent: true } : {}),
        };
      });
      const tagCounts = Object.entries((res.tagCounts as Record<string, number> | undefined) ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40);
      return { total: res.total, page: res.page, totalPages: res.totalPages, items, topTags: Object.fromEntries(tagCounts) };
    },
  },
  {
    name: "upload_media",
    title: "Add an image to the media library",
    description: "Import an image into the workspace media library from a public URL (or a data: URL), with an optional title and tags. Images only, up to 5 MB. Returns the library URL to use in blocks.",
    scope: SCOPE_PAGES,
    readOnly: false,
    input: {
      url: z.string().min(1).max(8_000_000),
      title: z.string().max(200).optional(),
      tags: z.array(z.string().max(60)).max(20).optional(),
    },
    run: async (ctx, args) => call(ctx, "POST", "/lp/media/import-url", pick(args as Row, ["url", "title", "tags"]), 60_000),
  },
  {
    name: "get_brand",
    title: "Get brand settings",
    description:
      "The workspace brand: colors, fonts (with stable font-file URLs for custom HTML), logos, button styling and the default CTA / Chili Piper settings.",
    scope: SCOPE_PAGES,
    readOnly: true,
    input: {},
    run: async (ctx) => {
      const brand = (await call(ctx, "GET", "/lp/brand")) as Row;
      const want = /(color|colou?r|font|logo|brandName|name$|button|radius|chili|cta|favicon|tagline|gradient|accent|primary|secondary|text|background)/i;
      const out: Row = {};
      for (const [k, v] of Object.entries(brand)) {
        if (!want.test(k) || v === null || v === undefined || v === "") continue;
        if (typeof v === "string" && v.length > 500) continue; // inline data URLs etc.
        if (typeof v === "object" && JSON.stringify(v).length > 2000) continue;
        out[k] = v;
      }
      const fontBase = `${ctx.origin}/api/lp/fonts`;
      return {
        brand: out,
        fonts: {
          display: brand.displayFont,
          body: brand.bodyFont,
          numbers: brand.numbersFont,
          stableFiles: Object.keys(STABLE_FONT_FILES).map((f) => `${fontBase}/${f}`),
          googleFontsCss: "Google families load from https://fonts.googleapis.com/css2?family=<Family>:wght@400;600;700&display=swap (stable).",
          example: `@font-face { font-family: 'Bagoss Standard'; src: url('${fontBase}/BagossStandard-Regular.woff2') format('woff2'); font-display: swap; }`,
        },
      };
    },
  },
  {
    name: "list_block_types",
    title: "List block types",
    description:
      "The block catalog. With no arguments: every block type with its role tags. With types: the props each block takes (as the page generator documents them), plus the full CTA and Chili Piper modal options and how custom-html blocks can open LP Studio's native CTA modals.",
    scope: SCOPE_PAGES,
    readOnly: true,
    input: {
      types: z.array(z.string().max(80)).max(20).optional(),
      query: z.string().max(80).optional().describe("Filter the type list by name or tag, e.g. 'cta', 'hero', 'form'."),
    },
    run: async (_ctx, args) => {
      const types = args.types as string[] | undefined;
      if (types?.length) {
        const { micrositeSchemaFor } = await import("../../routes/sales/generate-microsite");
        return {
          blocks: types.map((t) => ({
            type: t,
            known: t in DEFAULT_BLOCK_TAGS,
            tags: DEFAULT_BLOCK_TAGS[t] ?? [],
            props: t === "custom-html" ? CUSTOM_HTML_DOC : t === "report-reader" ? REPORT_READER_DOC : (micrositeSchemaFor(t) ?? "No prop doc for this type. Read an existing block of this type with get_page to see its props."),
          })),
          blockShape: "{ id: unique string, type, props: {...}, blockSettings?: {...}, children?: Block[] (section, columns, grid, stack only) }",
          blockSettings: BLOCK_SETTINGS_DOC,
          cta: CTA_DOC,
        };
      }
      const q = String(args.query ?? "").toLowerCase();
      const all = Object.entries(DEFAULT_BLOCK_TAGS)
        .filter(([t, tags]) => !q || t.includes(q) || tags.some((g) => g.includes(q)))
        .map(([t, tags]) => `${t} [${tags.join(", ")}]`);
      return {
        total: all.length,
        types: all,
        next: "Call again with types: [...] for props. CTA / Chili Piper options and custom-html's native CTA bridge come with any types call.",
      };
    },
  },
];
