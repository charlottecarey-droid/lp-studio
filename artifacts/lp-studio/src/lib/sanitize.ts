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
 * Sanitizer for SCHEMA-DRIVEN custom-block templates (SchemaPreviewFrame +
 * BlockCustomSchema) — same rails as {@link sanitizeHtml} EXCEPT `<style>` is
 * allowed. Custom-block templates are "plain HTML + inline <style> only" by
 * contract: the server validator (custom-blocks-validator.ts) enforces no
 * script/iframe/handlers and the generator scopes every selector under the
 * block's unique root class. The general-purpose sanitizeHtml FORBIDs <style>
 * (correct for rich text / pasted content) — running block templates through
 * it stripped ALL of their CSS at render, which is why every custom block
 * rendered unstyled from the May 2026 hardening until this fix (July 2026).
 *
 * DOMPurify does not inspect CSS text, so the one loophole `<style>` opens is
 * closed here directly: `@import` (an external-stylesheet load, same class as
 * the already-blocked external <link href>) is stripped from style contents.
 */
export function sanitizeBlockTemplateHtml(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, {
    ADD_TAGS: ["style", "video", "source"],
    ADD_ATTR: [
      "target", "rel",
      "autoplay", "muted", "loop", "playsinline", "poster", "preload",
      "controls", "controlslist", "disablepictureinpicture",
    ],
    FORBID_TAGS: ["script", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
  return clean.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open, css, close) =>
      open + css.replace(/@import[^;]*(;|$)/gi, "") + close,
  );
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
