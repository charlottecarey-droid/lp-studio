/**
 * Partner Hub emails to the customer (the link to get in, an invitation):
 * the body that goes inside the workspace's own email shell, so the message
 * looks like it came from the partner the customer knows, not from LP Studio.
 *
 * The shell draws the logo, header colour and footer. It has no headline of
 * its own, so the body carries it. Every dynamic value is escaped here; the
 * returned string has no `{{token}}` for the shell render to blank.
 */
import { escapeHtml } from "./emailRender";

/** Black or white, whichever reads better on a colour. Anything that isn't a hex colour is treated as dark. */
export function readableOn(hex: string): "#FFFFFF" | "#14161A" {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#FFFFFF";
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#14161A" : "#FFFFFF";
}

export function roomActionEmailBody(opts: {
  headline: string;
  /** Trusted HTML: the caller escapes every dynamic value in it. */
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  /** The button colour: the shell's header colour, so it matches the workspace's brand. */
  buttonColor: string;
  expiryNote?: string;
  footerNote?: string;
}): string {
  const url = escapeHtml(opts.ctaUrl);
  const button = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(opts.buttonColor.trim()) ? opts.buttonColor.trim() : "#1A1815";
  const font = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
  const small = (text: string, top: number) => `
              <p style="margin:${top}px 0 0 0;font-family:${font};font-size:13px;line-height:1.6;color:#6B6660;">${escapeHtml(text)}</p>`;
  return `<h1 style="margin:0;font-family:${font};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#1A1815;">${escapeHtml(opts.headline)}</h1>
              <p style="margin:18px 0 0 0;font-family:${font};font-size:16px;line-height:1.62;color:#2A2722;">
                ${opts.bodyHtml}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="background:${button};border-radius:8px;">
                    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${font};font-size:15px;font-weight:600;color:${readableOn(button)};text-decoration:none;border-radius:8px;">${escapeHtml(opts.ctaLabel)}</a>
                  </td>
                </tr>
              </table>${opts.expiryNote ? small(opts.expiryNote, 24) : ""}
              <p style="margin:16px 0 0 0;font-family:${font};font-size:13px;line-height:1.6;color:#6B6660;">
                Or paste this link into your browser:<br />
                <a href="${url}" target="_blank" style="color:#6B6660;word-break:break-all;">${url}</a>
              </p>${opts.footerNote ? small(opts.footerNote, 16) : ""}`;
}
