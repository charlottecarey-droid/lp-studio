const ALLOWED_TAGS = new Set([
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "A",
  "SPAN",
  "BR",
]);

const ALLOWED_ATTRS: Record<string, ReadonlyArray<string>> = {
  A: ["href", "target", "rel"],
  SPAN: ["style"],
};

const ALLOWED_STYLE_PROPS = new Set(["color", "font-size", "font-weight"]);

function sanitizeHref(href: string | null): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("#") ||
    lower.startsWith("/")
  ) {
    return trimmed;
  }
  return null;
}

function sanitizeStyle(value: string | null): string | null {
  if (!value) return null;
  const declarations: string[] = [];
  for (const part of value.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) continue;
    const prop = trimmed.slice(0, idx).trim().toLowerCase();
    const val = trimmed.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (/(expression|url\s*\(|javascript:|@import)/i.test(val)) continue;
    declarations.push(`${prop}: ${val}`);
  }
  return declarations.length ? declarations.join("; ") : null;
}

function walk(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();

  // Unwrap disallowed tags but keep their text/inline children.
  const keepTag = ALLOWED_TAGS.has(tag);
  const fragment: ChildNode[] = [];
  el.childNodes.forEach(child => {
    const sanitized = walk(child, doc);
    if (sanitized) fragment.push(sanitized as ChildNode);
  });

  if (!keepTag) {
    if (fragment.length === 0) return null;
    if (fragment.length === 1) return fragment[0];
    const wrapper = doc.createDocumentFragment();
    fragment.forEach(c => wrapper.appendChild(c));
    return wrapper;
  }

  const out = doc.createElement(tag.toLowerCase());
  const allowed = ALLOWED_ATTRS[tag] ?? [];
  for (const attr of allowed) {
    const raw = el.getAttribute(attr);
    if (raw == null) continue;
    if (tag === "A" && attr === "href") {
      const safe = sanitizeHref(raw);
      if (safe) out.setAttribute("href", safe);
    } else if (tag === "SPAN" && attr === "style") {
      const safe = sanitizeStyle(raw);
      if (safe) out.setAttribute("style", safe);
    } else if (tag === "A" && attr === "target") {
      out.setAttribute("target", raw === "_blank" ? "_blank" : "_self");
    } else if (tag === "A" && attr === "rel") {
      // rebuilt below for _blank
    }
  }
  if (tag === "A" && out.getAttribute("target") === "_blank") {
    out.setAttribute("rel", "noopener noreferrer");
  }
  fragment.forEach(c => out.appendChild(c));
  // Drop empty span wrappers that have no allowed style.
  if (
    tag === "SPAN" &&
    !out.getAttribute("style") &&
    out.childNodes.length === 1
  ) {
    return out.firstChild;
  }
  return out;
}

export function sanitizeInlineHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  const out = doc.createElement("div");
  root.childNodes.forEach(child => {
    const sanitized = walk(child, doc);
    if (sanitized) out.appendChild(sanitized);
  });
  return out.innerHTML;
}

const HTML_TAG_RE = /<\/?(?:strong|b|em|i|u|a|span|br)\b/i;

export function isLikelyHtml(value: string): boolean {
  return HTML_TAG_RE.test(value);
}
