import { useEffect, useRef } from "react";
import type { CustomHtmlBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: CustomHtmlBlockProps;
  brand: BrandConfig;
}

export function BlockCustomHtml({ props }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // If the user pasted a complete HTML document, write it as-is so their own
    // <head>, <style>, <body> styling (including `html, body { ... }` rules)
    // applies correctly. Otherwise, wrap the snippet in a minimal shell.
    const raw = (props.html || "").trim();
    const isFullDoc = /^<!doctype/i.test(raw) || /^<html[\s>]/i.test(raw);

    // every link inside the iframe should navigate the *top* window, not the
    // iframe itself — otherwise clicking a footer/menu link reloads the page
    // inside the embed and looks broken. <base target="_top"> handles links
    // that don't set their own target. paired with the
    // `allow-top-navigation-by-user-activation` sandbox token below, this lets
    // user-clicked links escape the frame while still blocking script-driven
    // top navigation.
    const baseTag = `<base target="_top">`;
    // for full HTML docs, inject the <base> right after <head> if the user
    // didn't already supply one — keeping their styling intact.
    const ensureBase = (doc: string): string => {
      if (/<base\s/i.test(doc)) return doc;
      if (/<head[^>]*>/i.test(doc)) {
        return doc.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
      }
      // no <head> at all — prepend a minimal one inside <html> so the base tag
      // is honoured.
      if (/<html[^>]*>/i.test(doc)) {
        return doc.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
      }
      return baseTag + doc;
    };

    const content = isFullDoc
      ? ensureBase(raw)
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

    doc.open();
    doc.write(content);
    doc.close();

    // Recompute height based on the larger of body/documentElement scrollHeight
    // (full-document HTML often relies on `html, body { min-height: 100vh }`,
    // which makes body height equal to the iframe height and breaks naive
    // measurement — documentElement gives the true content height).
    const measure = () => {
      const d = iframe.contentDocument;
      if (!d) return;
      const h = Math.max(
        d.body?.scrollHeight ?? 0,
        d.documentElement?.scrollHeight ?? 0,
        d.body?.offsetHeight ?? 0,
        d.documentElement?.offsetHeight ?? 0,
      );
      if (h > 0) iframe.style.height = h + "px";
    };

    const resizeObserver = new ResizeObserver(measure);
    if (doc.body) resizeObserver.observe(doc.body);
    if (doc.documentElement) resizeObserver.observe(doc.documentElement);

    // Initial + post-load measurements (covers fonts, images, and inline
    // scripts that mutate the DOM after parse).
    measure();
    iframe.contentWindow?.addEventListener("load", measure);
    const t1 = window.setTimeout(measure, 100);
    const t2 = window.setTimeout(measure, 500);

    return () => {
      resizeObserver.disconnect();
      iframe.contentWindow?.removeEventListener("load", measure);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [props.html]);

  if (!props.html || props.html.trim() === "") {
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
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        className="w-full border-0"
        style={{ minHeight: "60px", display: "block" }}
        scrolling="no"
      />
    </div>
  );
}
