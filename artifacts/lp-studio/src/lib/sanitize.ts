import DOMPurify from "dompurify";

/**
 * Sanitize HTML to prevent XSS attacks.
 * Allows safe HTML tags/attributes used in rich text content.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    // `iframe` is kept for legacy callers (rich-text embeds); custom-block
    // templates from the generator should prefer <video> for background
    // media — see `custom-blocks-validator.ts` which blocks <iframe>.
    // <video>/<source> let the generator produce full-bleed background
    // videos (Dandy-style hero) without an iframe.
    ADD_TAGS: ["iframe", "video", "source"],
    ADD_ATTR: [
      "target", "rel", "allow", "allowfullscreen", "frameborder",
      // Safe HTML5 <video>/<source> attrs for autoplay background loops.
      "autoplay", "muted", "loop", "playsinline", "poster", "preload",
      "controls", "controlslist", "disablepictureinpicture",
    ],
    FORBID_TAGS: ["script", "style"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

/**
 * Escape HTML entities and linkify bare URLs in plain text, mirroring the
 * server send path (`escapeAndLinkifyPlainText` in the campaigns route). Used
 * so plain-format email templates (content stored in `bodyText`) preview the
 * same way they actually send. Caller should render the result inside a
 * container with `white-space: pre-wrap` to preserve line breaks/whitespace.
 */
export function escapeAndLinkifyPlainText(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/https?:\/\/[^\s<]+/g, (match) => {
    const m = /^(.*?)([.,;:!?)]*)$/s.exec(match);
    const url = m ? m[1] : match;
    const trailing = m ? m[2] : "";
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
  });
}
