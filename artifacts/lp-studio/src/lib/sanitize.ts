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
