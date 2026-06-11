import { useEffect, useMemo, useRef } from "react";
import type { CustomHtmlBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: CustomHtmlBlockProps;
  brand: BrandConfig;
}

/**
 * Injected into the sandboxed iframe so it can report its own content height
 * back to the parent. The frame runs WITHOUT `allow-same-origin` (it lives in
 * an opaque origin so author scripts can't touch the parent's cookies /
 * localStorage / DOM), which also means the parent can no longer read
 * `contentDocument` to measure it — the frame must volunteer its height via
 * postMessage instead.
 */
const HEIGHT_REPORTER = `<script>(function(){
  function h(){
    var b=document.body,e=document.documentElement;
    return Math.max(
      b?b.scrollHeight:0, e?e.scrollHeight:0,
      b?b.offsetHeight:0, e?e.offsetHeight:0
    );
  }
  function post(){ try{ parent.postMessage({__lpCustomHtmlHeight:h()},"*"); }catch(_){} }
  try{
    if(typeof ResizeObserver!=="undefined"){
      var ro=new ResizeObserver(post);
      if(document.body) ro.observe(document.body);
      if(document.documentElement) ro.observe(document.documentElement);
    }
  }catch(_){}
  window.addEventListener("load",post);
  post();
  setTimeout(post,100);
  setTimeout(post,500);
})();</scr` + `ipt>`;

/**
 * Splice the height-reporter script in just before the closing </body> (or
 * append it when the author's markup has no body tag) so it parses and runs
 * inside the frame after their own content.
 */
function injectHeightReporter(html: string): string {
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx !== -1) {
    return html.slice(0, idx) + HEIGHT_REPORTER + html.slice(idx);
  }
  return html + HEIGHT_REPORTER;
}

/**
 * Build the full HTML document rendered inside the (origin-isolated) iframe.
 * Author HTML is intentionally NOT sanitized here — the custom-HTML block is a
 * deliberate raw-embed escape hatch (scripts/styles are part of its contract).
 * Safety comes from the iframe sandbox dropping `allow-same-origin`, so the
 * author's code cannot reach the embedding page's session/storage/DOM. It is
 * therefore critical that this content is ONLY ever delivered via `srcdoc` to a
 * sandbox WITHOUT `allow-same-origin`, never written into a same-origin
 * document.
 */
function buildSrcDoc(raw: string): string {
  if (!raw) return "";

  // If the user pasted a complete HTML document, write it as-is so their own
  // <head>, <style>, <body> styling (including `html, body { ... }` rules)
  // applies correctly. Otherwise, wrap the snippet in a minimal shell.
  const isFullDoc = /^<!doctype/i.test(raw) || /^<html[\s>]/i.test(raw);

  // every link inside the iframe should navigate the *top* window, not the
  // iframe itself — otherwise clicking a footer/menu link reloads the page
  // inside the embed and looks broken. <base target="_top"> handles links
  // that don't set their own target. paired with the
  // `allow-top-navigation-by-user-activation` sandbox token below, this lets
  // user-clicked links escape the frame while still blocking script-driven
  // top navigation.
  const baseTag = `<base target="_top">`;
  // Default body-margin reset injected BEFORE the user's own styles so the
  // user's CSS can still override it. Without this, a pasted full HTML doc
  // inherits the browser default `body { margin: 8px }`, which renders as a
  // white frame around dark backgrounds (e.g. the meetdandy footer's
  // #003A30 fill). Pairs with the snippet-branch reset below.
  const defaultStyleTag = `<style>body{margin:0}</style>`;
  // for full HTML docs, inject the <base> + default reset right after
  // <head> if the user didn't already supply one — keeping their styling
  // intact (their later <style> rules still win).
  const ensureBaseAndReset = (doc: string): string => {
    const headInjection =
      (/(<base\s)/i.test(doc) ? "" : baseTag) + defaultStyleTag;
    if (/<head[^>]*>/i.test(doc)) {
      return doc.replace(/<head([^>]*)>/i, `<head$1>${headInjection}`);
    }
    // no <head> at all — prepend a minimal one inside <html> so the tags
    // are honoured.
    if (/<html[^>]*>/i.test(doc)) {
      return doc.replace(
        /<html([^>]*)>/i,
        `<html$1><head>${headInjection}</head>`,
      );
    }
    return headInjection + doc;
  };

  const content = isFullDoc
    ? ensureBaseAndReset(raw)
    : `<!DOCTYPE html>
<html>
<head>
${baseTag}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }
</style>
</head>
<body>${raw}</body>
</html>`;

  return injectHeightReporter(content);
}

export function BlockCustomHtml({ props }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const raw = (props.html || "").trim();
  const srcDoc = useMemo(() => buildSrcDoc(raw), [raw]);

  // The frame is origin-isolated (no `allow-same-origin`), so we can't read its
  // contentDocument to size it. Listen for the height it posts back instead.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const data = e.data as { __lpCustomHtmlHeight?: unknown } | null;
      const h =
        data && typeof data === "object" && typeof data.__lpCustomHtmlHeight === "number"
          ? data.__lpCustomHtmlHeight
          : null;
      // Height is reported by the (sandboxed) frame, so clamp it to a sane
      // ceiling — a hostile embed can't blow up the page to an absurd height.
      if (h !== null && h > 0) iframe.style.height = Math.min(h, 20000) + "px";
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [srcDoc]);

  if (!raw) {
    return (
      <div className="py-12 px-8 text-center text-muted-foreground text-sm italic">
        Custom HTML block — add HTML in the properties panel
      </div>
    );
  }

  return (
    <div className="custom-html-block w-full overflow-hidden">
      <iframe
        ref={iframeRef}
        title="Custom HTML Block"
        // SECURITY: `allow-same-origin` is intentionally omitted. Combining it
        // with `allow-scripts` would let author-supplied script run in the
        // parent's origin and read the reviewer/visitor session token from
        // localStorage (stored XSS). Without it the frame gets an opaque origin
        // — scripts still run but are walled off from the parent. Do NOT add
        // `allow-same-origin` back.
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        srcDoc={srcDoc}
        className="w-full border-0"
        style={{ minHeight: "60px", display: "block" }}
        scrolling="no"
      />
    </div>
  );
}
