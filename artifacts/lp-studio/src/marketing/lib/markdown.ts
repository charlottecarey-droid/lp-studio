/**
 * Tiny, dependency-free markdown to sanitized HTML renderer for blog post
 * bodies. Authored posts are stored as markdown TEXT (see lib/db blog_posts);
 * this turns them into HTML the article view injects via dangerouslySetInnerHTML.
 *
 * The renderer is deliberately small but SANITIZING: it escapes ALL raw HTML by
 * default, then RE-ALLOWS a small allowlist of safe tags so authored inline
 * <svg> infographics and <img> render, while stripping <script>, event-handler
 * attributes (on*), and javascript: URLs. This lets the owner embed a clean
 * brand-colored infographic without opening an XSS hole.
 *
 * Supported markdown: ATX headings, unordered (-/*) and ordered lists,
 * blockquotes (>), fenced code blocks, inline code, bold (**), italics (_),
 * links, images, horizontal rules, and paragraphs. Good enough for editorial
 * how-to posts; not a full CommonMark implementation.
 */

// Tags allowed to pass through as RAW HTML (e.g. authored inline infographics).
const RAW_HTML_ALLOWLIST = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
  "polygon", "text", "tspan", "defs", "lineargradient", "radialgradient",
  "stop", "title", "desc", "use", "symbol", "marker", "img", "figure",
  "figcaption", "br", "span", "div", "table", "thead", "tbody", "tr", "th",
  "td",
]);

// Attributes allowed on raw-HTML tags. Anything else (notably on* handlers) is
// dropped. URL attributes are additionally checked for javascript: schemes.
const ATTR_ALLOWLIST = new Set([
  "viewbox", "width", "height", "fill", "stroke", "stroke-width", "stroke-linecap",
  "stroke-linejoin", "stroke-dasharray", "d", "x", "y", "x1", "y1", "x2", "y2",
  "cx", "cy", "r", "rx", "ry", "points", "transform", "opacity", "fill-opacity",
  "stroke-opacity", "offset", "stop-color", "stop-opacity", "gradientunits",
  "text-anchor", "font-size", "font-family", "font-weight", "letter-spacing",
  "class", "id", "xmlns", "aria-hidden", "role", "preserveaspectratio",
  "alt", "src", "loading", "decoding", "colspan", "rowspan", "dominant-baseline",
]);

const URL_ATTRS = new Set(["src", "href"]);

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

/**
 * Sanitize a single raw HTML tag token. Allowlisted tags are re-emitted with
 * only allowlisted attributes (and safe URLs); everything else is escaped so it
 * renders as visible text rather than live markup.
 */
function sanitizeTag(token: string): string {
  const closing = /^<\s*\//.test(token);
  const nameMatch = token.match(/^<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/);
  const name = nameMatch ? nameMatch[1].toLowerCase() : "";
  if (!name || !RAW_HTML_ALLOWLIST.has(name)) {
    return escapeHtml(token);
  }
  if (closing) return `</${name}>`;

  const selfClose = /\/\s*>$/.test(token);
  const attrs: string[] = [];
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(token)) !== null) {
    const attr = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? "";
    if (attr.startsWith("on")) continue;
    if (!ATTR_ALLOWLIST.has(attr)) continue;
    const finalValue = URL_ATTRS.has(attr) ? safeUrl(value) : value;
    attrs.push(`${attr}="${escapeHtml(finalValue)}"`);
  }
  if (name === "img") {
    attrs.push('style="max-width:100%;height:auto"');
    if (!/loading=/.test(attrs.join(" "))) attrs.push('loading="lazy"');
  }
  const open = `<${name}${attrs.length ? " " + attrs.join(" ") : ""}${selfClose ? " /" : ""}>`;
  return open;
}

/**
 * Walk a string, escaping all HTML EXCEPT allowlisted tags (which are
 * sanitized). Token-by-token so an attacker cannot smuggle a <script> through.
 */
function sanitizeRawHtml(input: string): string {
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

/** Inline markdown to HTML (bold, italic, code, links, images). Sanitized. */
function renderInline(text: string): string {
  // Extract anything that yields final HTML (inline code, images, links) into
  // placeholder slots FIRST so their URLs/contents are not mangled by the
  // raw-HTML sanitizer and the bold/italic passes do not reach inside them.
  // Then the remaining prose is run through sanitizeRawHtml (the XSS guard:
  // raw <script>/disallowed tags become visible text; allowlisted inline tags
  // survive). The placeholder token uses no markdown-special characters.
  const slots: string[] = [];
  const slot = (htmlFragment: string): string => {
    slots.push(htmlFragment);
    return ` SLOT${slots.length - 1} `;
  };

  let t = text;

  // Inline code
  t = t.replace(/`([^`]+)`/g, (_, code) => slot(`<code>${escapeHtml(code)}</code>`));

  // Images ![alt](url)
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
    const safe = safeUrl(url);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return slot(
      `<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" decoding="async" style="max-width:100%;height:auto;border-radius:8px" />`,
    );
  });

  // Links [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url) => {
    const safe = safeUrl(url);
    const external = /^https?:\/\//i.test(safe);
    const rel = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return slot(`<a href="${escapeHtml(safe)}"${rel}>${escapeHtml(label)}</a>`);
  });

  // Escape raw HTML in the remaining prose.
  t = sanitizeRawHtml(t);

  // Bold then italics.
  t = t.replace(/\*\*([^*]+)\*\*/g, (_, b) => `<strong>${b}</strong>`);
  t = t.replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, (_, pre, it) => `${pre}<em>${it}</em>`);

  // Restore placeholders.
  t = t.replace(/ SLOT(\d+) /g, (_, n) => slots[Number(n)] ?? "");
  return t;
}

/**
 * Render a markdown string to sanitized HTML. Block-level parsing is line
 * based; raw-HTML blocks (e.g. an inline <svg> infographic spanning lines) are
 * detected and passed through the sanitizer untouched by inline formatting.
 */
export function renderMarkdown(md: string): string {
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

    // Fenced code block
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

    // Raw HTML block (allowlisted) starting a line with an allowlisted tag.
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
      html.push(`<div class="lp-blog-embed">${sanitizeRawHtml(buf.join("\n"))}</div>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      html.push("<hr />");
      i++;
      continue;
    }

    // Heading
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
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

    // Ordered list
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

    // Unordered list
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

    // Blank line -> paragraph boundary
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
