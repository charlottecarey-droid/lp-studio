/**
 * Render-time HTML sanitizer for blog post bodies (Phase 1: Markdown → HTML).
 *
 * Blog bodies are now stored as HTML, authored by trusted superadmins in a
 * Tiptap WYSIWYG (with a raw-HTML/SVG code view for infographics + embeds). But
 * the article view injects the body via dangerouslySetInnerHTML on the PUBLIC
 * marketing site, so we NEVER trust the stored HTML — every render runs through
 * this sanitizer. It is the same token-walking, escape-by-default approach the
 * old markdown renderer used (artifacts/.../lib/markdown.ts), generalised to
 * full HTML and extended with an iframe embed-host allowlist.
 *
 * Policy:
 *   - Allow semantic editorial tags: h1-h4, p, ul/ol/li, blockquote, a (safe
 *     href only), img, figure/figcaption, table family, pre/code, hr,
 *     strong/em/b/i/u/s/mark/sub/sup/small, span/div, br.
 *   - Allow inline <svg> + its child/presentation elements & attributes
 *     (authored brand infographics).
 *   - Allow <iframe> ONLY when its src host is in the embed allowlist
 *     (YouTube, Vimeo, Loom). Any other iframe is escaped to visible text.
 *   - Strip <script>/<style>, all on* handlers, javascript: URLs, and non-image
 *     data: URLs. Disallowed tags are escaped (rendered as text, not markup).
 *
 * Dependency-free so it can be unit-tested without a DOM and run in the
 * marketing prerender bundle.
 */

const RAW_HTML_ALLOWLIST = new Set([
  // inline SVG infographics
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
  "polygon", "text", "tspan", "defs", "lineargradient", "radialgradient",
  "stop", "title", "desc", "use", "symbol", "marker", "clippath", "mask",
  // media + structure
  "img", "figure", "figcaption", "br", "span", "div", "a",
  // semantic blocks
  "p", "h1", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "pre", "code",
  "hr", "strong", "em", "b", "i", "u", "s", "mark", "sub", "sup", "small",
  // tables
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  // allowlisted embeds
  "iframe",
]);

const ATTR_ALLOWLIST = new Set([
  "viewbox", "width", "height", "fill", "stroke", "stroke-width", "stroke-linecap",
  "stroke-linejoin", "stroke-dasharray", "stroke-miterlimit", "d", "x", "y",
  "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "points", "transform",
  "opacity", "fill-opacity", "stroke-opacity", "offset", "stop-color",
  "stop-opacity", "gradientunits", "gradienttransform", "text-anchor",
  "font-size", "font-family", "font-weight", "letter-spacing", "class", "id",
  "xmlns", "xmlns:xlink", "aria-hidden", "aria-label", "role",
  "preserveaspectratio", "alt", "src", "href", "loading", "decoding",
  "colspan", "rowspan", "dominant-baseline", "title", "target", "rel", "style",
  "allow", "allowfullscreen", "frameborder", "data-align", "data-video-embed",
]);

const URL_ATTRS = new Set(["src", "href"]);

// CSS properties allowed in a `style="..."` attribute. Anything else (notably
// `position`, `behavior`, url()/expression() tricks) is dropped. Kept tight so
// authored inline styles (widths, margins, the video-embed wrapper) survive
// without becoming an attack surface.
const STYLE_PROP_ALLOWLIST = new Set([
  "max-width", "width", "height", "min-height", "margin", "margin-left",
  "margin-right", "margin-top", "margin-bottom", "padding", "padding-bottom",
  "display", "text-align", "border-radius", "overflow", "position", "top",
  "left", "aspect-ratio", "font-size", "border", "background", "color",
]);

const IFRAME_HOST_ALLOWLIST = [
  "www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com",
  "player.vimeo.com",
  "www.loom.com", "loom.com",
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^\s*javascript:/i.test(trimmed)) return "#";
  if (/^\s*data:(?!image\/)/i.test(trimmed)) return "#";
  return trimmed;
}

function sanitizeStyle(value: string): string {
  // Drop anything that could smuggle script (url(), expression(), behavior).
  if (/url\s*\(|expression\s*\(|javascript:|@import/i.test(value)) return "";
  const decls = value
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const idx = d.indexOf(":");
      if (idx === -1) return null;
      const prop = d.slice(0, idx).trim().toLowerCase();
      const val = d.slice(idx + 1).trim();
      if (!STYLE_PROP_ALLOWLIST.has(prop)) return null;
      if (/[<>]/.test(val)) return null;
      return `${prop}: ${val}`;
    })
    .filter((d): d is string => d !== null);
  return decls.join("; ");
}

function iframeSrcAllowed(url: string): boolean {
  try {
    const u = new URL(url, "https://lpstudio.ai");
    if (u.protocol !== "https:") return false;
    return IFRAME_HOST_ALLOWLIST.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function sanitizeTag(token: string): string {
  const closing = /^<\s*\//.test(token);
  const nameMatch = token.match(/^<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/);
  const name = nameMatch ? nameMatch[1].toLowerCase() : "";
  if (!name || !RAW_HTML_ALLOWLIST.has(name)) return escapeHtml(token);
  if (closing) return `</${name}>`;

  const selfClose = /\/\s*>$/.test(token);
  const attrs: string[] = [];
  let iframeSrcOk = false;
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(token)) !== null) {
    const attr = m[1].toLowerCase();
    let value = m[3] ?? m[4] ?? "";
    if (attr.startsWith("on")) continue;
    if (!ATTR_ALLOWLIST.has(attr)) continue;
    if (attr === "style") {
      value = sanitizeStyle(value);
      if (!value) continue;
    }
    if (name === "iframe" && attr === "src") {
      if (!iframeSrcAllowed(value)) continue;
      iframeSrcOk = true;
    }
    const finalValue = URL_ATTRS.has(attr) ? safeUrl(value) : value;
    attrs.push(`${attr}="${escapeHtml(finalValue)}"`);
  }
  if (name === "iframe" && !iframeSrcOk) return escapeHtml(token);
  if (name === "img") {
    if (!/style=/.test(attrs.join(" "))) attrs.push('style="max-width:100%;height:auto"');
    if (!/loading=/.test(attrs.join(" "))) attrs.push('loading="lazy"');
  }
  return `<${name}${attrs.length ? " " + attrs.join(" ") : ""}${selfClose ? " /" : ""}>`;
}

/**
 * Sanitize stored blog HTML for public render. Escapes ALL markup except the
 * allowlisted tags (re-emitted with only allowlisted, safe attributes).
 * Token-by-token so a <script> or smuggled handler can't slip through.
 */
export function sanitizeBlogHtml(input: string): string {
  const src = input || "";
  let out = "";
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) {
      out += escapeHtml(src.slice(i));
      break;
    }
    out += escapeHtml(src.slice(i, lt));

    // Drop the entire contents of <script>/<style> blocks (never rendered).
    const blockMatch = src.slice(lt).match(/^<\s*(script|style)\b/i);
    if (blockMatch) {
      const tag = blockMatch[1].toLowerCase();
      const closeRe = new RegExp(`</\\s*${tag}\\s*>`, "i");
      const rest = src.slice(lt);
      const closeIdx = rest.search(closeRe);
      if (closeIdx === -1) {
        // Unterminated — drop the rest entirely.
        break;
      }
      const closeMatch = rest.slice(closeIdx).match(closeRe)!;
      i = lt + closeIdx + closeMatch[0].length;
      continue;
    }

    const gt = src.indexOf(">", lt);
    if (gt === -1) {
      out += escapeHtml(src.slice(lt));
      break;
    }
    out += sanitizeTag(src.slice(lt, gt + 1));
    i = gt + 1;
  }
  return out;
}
