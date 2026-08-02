/**
 * "Copy email preview" — the Userled-style embed for outreach emails.
 *
 * Email clients don't unfurl pasted links (no Slack-style cards), so the way
 * this works everywhere (Gmail, Outlook, Superhuman) is a RICH-HTML clipboard
 * payload: a linked screenshot of the page plus a text link underneath. The
 * rep clicks one button, pastes into their compose window, and the recipient
 * sees a real preview of their personalized page that clicks through to it.
 *
 * The image comes from `POST /api/lp/pages/:id/email-preview`, which resolves
 * the page's OG share-card cascade and lazily captures a fresh self-hosted
 * screenshot (lib/pageScreenshot.ts — correct fonts) when the page has none.
 *
 * Clipboard notes:
 *  - `ClipboardItem` with a text/html part is what makes Gmail paste the
 *    image+link block; text/plain carries the bare URL for plain composers.
 *  - Requires a secure context + user gesture — always call from a click
 *    handler. On any failure we fall back to copying the plain link so the
 *    button never leaves the rep empty-handed.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pure snippet builder — exported for tests. `imageUrl` must be absolute
 *  (email clients fetch it with no page context). */
export function buildEmailPreviewHtml(args: {
  pageUrl: string;
  imageUrl: string;
  title?: string | null;
}): string {
  const href = escapeHtml(args.pageUrl);
  const img = escapeHtml(args.imageUrl);
  const label = escapeHtml((args.title ?? "").trim() || "Take a look");
  return (
    `<div>` +
    `<a href="${href}" target="_blank" style="text-decoration:none;">` +
    `<img src="${img}" alt="${label}" width="480" ` +
    `style="display:block;width:480px;max-width:100%;border:1px solid #e4e7ec;border-radius:12px;" />` +
    `</a>` +
    `<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;">` +
    `<a href="${href}" target="_blank" style="color:#2563eb;font-weight:bold;">${label} &rarr;</a>` +
    `</p>` +
    `</div>`
  );
}

/** "Ava Nguyen" → "Ava". Returns "" when there's nothing usable, so callers
 *  fall back to a name-less greeting instead of writing "Hey ,". */
export function firstNameOf(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  // An email-shaped "name" is not a first name.
  return first.includes("@") ? "" : first;
}

/**
 * Subject + plain-text body for a one-click outreach compose.
 *
 * The body deliberately carries the URL even though the rep is about to paste
 * the rich card over/under it: a compose URL cannot transport an image, so the
 * paste is a manual step, and an un-pasted send must still be a working email
 * rather than "Hey Ava," followed by nothing.
 */
export function buildOutreachEmail(args: {
  firstName?: string | null;
  pageTitle?: string | null;
  url: string;
}): { subject: string; body: string } {
  const first = firstNameOf(args.firstName);
  const title = (args.pageTitle ?? "").trim();
  const greeting = first ? `Hey ${first},` : "Hey,";
  return {
    subject: title || "A page for you",
    body: `${greeting}\n\nI put together a page just for you:\n${args.url}\n\n`,
  };
}

/** Gmail web compose URL. Gmail ignores HTML in `body`, which is why the card
 *  itself rides the clipboard instead. */
export function buildGmailComposeUrl(args: {
  to?: string | null;
  subject: string;
  body: string;
}): string {
  const params = new URLSearchParams({ view: "cm", fs: "1", su: args.subject, body: args.body });
  const to = (args.to ?? "").trim();
  if (to) params.set("to", to);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export type EmailPreviewCopyResult = "rich" | "link-only";

/**
 * Fetch (or lazily capture) the page's preview image, then put the rich
 * image+link snippet on the clipboard. Falls back to copying the bare link
 * when the capture fails or the browser can't write HTML clipboard items.
 */
export async function copyEmailPreview(args: {
  pageId: number;
  /** The link the recipient should land on (usually the personalized /p/ URL). */
  pageUrl: string;
  title?: string | null;
}): Promise<EmailPreviewCopyResult> {
  let imageUrl = "";
  try {
    const res = await fetch(`/api/lp/pages/${args.pageId}/email-preview`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { imageUrl?: string };
      imageUrl = (data.imageUrl ?? "").trim();
    }
  } catch {
    /* fall through to link-only */
  }

  const absImageUrl = imageUrl ? new URL(imageUrl, window.location.origin).toString() : "";
  const canWriteRich =
    !!absImageUrl && typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

  if (canWriteRich) {
    try {
      const html = buildEmailPreviewHtml({
        pageUrl: args.pageUrl,
        imageUrl: absImageUrl,
        title: args.title,
      });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([args.pageUrl], { type: "text/plain" }),
        }),
      ]);
      return "rich";
    } catch {
      /* fall through to link-only */
    }
  }

  await navigator.clipboard.writeText(args.pageUrl);
  return "link-only";
}
