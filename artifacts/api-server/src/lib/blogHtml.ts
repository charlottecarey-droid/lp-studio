/**
 * Server-side blog body helpers for the Markdown → HTML migration (Phase 1).
 *
 * Blog post bodies are now stored as sanitized HTML (the `body` column keeps its
 * name — HTML fits in `text`, so no rename/dual-read is needed). Authoring moved
 * to a Tiptap WYSIWYG that emits HTML, and the public renderer re-sanitizes on
 * render (never trusting stored HTML). But two server-side flows still need to
 * turn the LEGACY markdown bodies into HTML:
 *
 *   1. The 5 seed posts ship HTML bodies authored from this conversion.
 *   2. A one-time, marker-gated, fail-open heal in migrate.ts converts any
 *      already-published DB rows whose bodies are still markdown.
 *
 * This module is intentionally dependency-free (no marked/jsdom/DOMPurify — the
 * api-server doesn't ship a markdown lib) and mirrors the FE renderer's grammar
 * (artifacts/lp-studio/src/marketing/lib/markdown.ts) so the conversion is
 * faithful: ATX headings, ordered/unordered lists, blockquotes, fenced code,
 * inline code, bold/italic, links, images, horizontal rules, paragraphs, and
 * pass-through of allowlisted raw HTML blocks (notably inline <svg> infographics).
 *
 * The output is the SAME HTML the FE renderer would have produced from the
 * markdown, so converting a row through this is lossless w.r.t. what readers
 * saw — headings, links, images, inline SVG, lists, and tables are preserved.
 * The public renderer still re-sanitizes it, so this does not need to be the
 * final XSS gate; it nonetheless escapes disallowed raw HTML the same way.
 */

// Tags allowed to pass through as RAW HTML (mirrors the FE renderer allowlist
// plus the iframe/embed wrappers the editor can produce). Anything else is
// escaped to visible text.
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

// Hosts allowed to be loaded in an <iframe> (embedded video/loom only).
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
    const value = m[3] ?? m[4] ?? "";
    if (attr.startsWith("on")) continue;
    if (!ATTR_ALLOWLIST.has(attr)) continue;
    if (name === "iframe" && attr === "src") {
      if (!iframeSrcAllowed(value)) continue;
      iframeSrcOk = true;
    }
    const finalValue = URL_ATTRS.has(attr) ? safeUrl(value) : value;
    attrs.push(`${attr}="${escapeHtml(finalValue)}"`);
  }
  // An iframe without an allowlisted src is dropped entirely (escaped).
  if (name === "iframe" && !iframeSrcOk) return escapeHtml(token);
  if (name === "img") {
    if (!/style=/.test(attrs.join(" "))) attrs.push('style="max-width:100%;height:auto"');
    if (!/loading=/.test(attrs.join(" "))) attrs.push('loading="lazy"');
  }
  const open = `<${name}${attrs.length ? " " + attrs.join(" ") : ""}${selfClose ? " /" : ""}>`;
  return open;
}

/** Walk a string escaping all HTML except allowlisted (sanitized) tags. */
export function sanitizeRawBlogHtml(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      out += escapeHtml(input.slice(i));
      break;
    }
    out += escapeHtml(input.slice(i, lt));
    const gt = input.indexOf(">", lt);
    if (gt === -1) {
      out += escapeHtml(input.slice(lt));
      break;
    }
    out += sanitizeTag(input.slice(lt, gt + 1));
    i = gt + 1;
  }
  return out;
}

function renderInline(text: string): string {
  const slots: string[] = [];
  const slot = (htmlFragment: string): string => {
    slots.push(htmlFragment);
    return ` SLOT${slots.length - 1} `;
  };
  let t = text;
  t = t.replace(/`([^`]+)`/g, (_, code) => slot(`<code>${escapeHtml(code)}</code>`));
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
    const safe = safeUrl(url);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return slot(
      `<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" decoding="async" style="max-width:100%;height:auto;border-radius:8px" />`,
    );
  });
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url) => {
    const safe = safeUrl(url);
    const external = /^https?:\/\//i.test(safe);
    const rel = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return slot(`<a href="${escapeHtml(safe)}"${rel}>${escapeHtml(label)}</a>`);
  });
  t = sanitizeRawBlogHtml(t);
  t = t.replace(/\*\*([^*]+)\*\*/g, (_, b) => `<strong>${b}</strong>`);
  t = t.replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, (_, pre, it) => `${pre}<em>${it}</em>`);
  t = t.replace(/ SLOT(\d+) /g, (_, n) => slots[Number(n)] ?? "");
  return t;
}

/**
 * Convert a markdown blog body to sanitized HTML. Faithful to the FE renderer's
 * grammar so converted rows render identically to how they did under markdown.
 */
export function markdownToHtml(md: string): string {
  const src = (md || "").replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  const html: string[] = [];
  let i = 0;
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join(" ").trim())}</p>`);
      paragraph = [];
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      flushParagraph();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      html.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    const rawTagMatch = trimmed.match(/^<\s*([a-zA-Z][a-zA-Z0-9]*)/);
    if (rawTagMatch && RAW_HTML_ALLOWLIST.has(rawTagMatch[1].toLowerCase())) {
      flushParagraph();
      const topTag = rawTagMatch[1].toLowerCase();
      const buf: string[] = [];
      const closeRe = new RegExp(`</\\s*${topTag}\\s*>`, "i");
      buf.push(line);
      let closed = closeRe.test(line);
      while (!closed && i + 1 < lines.length) {
        i++;
        buf.push(lines[i]);
        if (closeRe.test(lines[i])) closed = true;
      }
      i++;
      // SVG/embed blocks get wrapped in the figure-style embed container so the
      // editorial CSS can frame + center them.
      html.push(`<div class="lp-blog-embed">${sanitizeRawBlogHtml(buf.join("\n"))}</div>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      html.push("<hr />");
      i++;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length, 6);
      html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      html.push(`<blockquote>${renderInline(buf.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`);
        i++;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (trimmed === "") {
      flushParagraph();
      i++;
      continue;
    }

    paragraph.push(trimmed);
    i++;
  }
  flushParagraph();
  return html.join("\n");
}

/**
 * Heuristic: does this body still look like markdown rather than HTML? Used by
 * the one-time heal to skip rows that are already HTML. Conservative — only
 * treats a body as markdown when it has NO block-level HTML tag AND shows a
 * markdown signal (ATX heading, list bullet, fenced code, or md link/image).
 * Bodies that are already HTML (the common case after migration) are left
 * untouched, making the heal safe to re-run.
 */
export function looksLikeMarkdown(body: string): boolean {
  const b = (body || "").trim();
  if (!b) return false;
  // Strong HTML signal: a block-level wrapper the WYSIWYG/heal would emit.
  if (/<(p|h[1-4]|ul|ol|blockquote|figure|div|table)\b/i.test(b)) return false;
  // Markdown signals.
  if (/^#{1,6}\s+/m.test(b)) return true;
  if (/^\s*[-*]\s+/m.test(b)) return true;
  if (/^\s*\d+\.\s+/m.test(b)) return true;
  if (/```/.test(b)) return true;
  if (/!?\[[^\]]*\]\([^)]*\)/.test(b)) return true;
  if (/^>\s+/m.test(b)) return true;
  return false;
}

/** Count words in an HTML (or markdown) body — strips tags, code, SVG, md. */
export function htmlWordCount(body: string): number {
  const text = (body || "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_`~|]/g, " ");
  return text.split(/\s+/).filter(Boolean).length;
}
