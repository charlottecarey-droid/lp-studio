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

    const content = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }
</style>
</head>
<body>${props.html || ""}</body>
</html>`;

    doc.open();
    doc.write(content);
    doc.close();

    const resizeObserver = new ResizeObserver(() => {
      if (iframe.contentDocument?.body) {
        iframe.style.height = iframe.contentDocument.body.scrollHeight + "px";
      }
    });

    if (doc.body) {
      resizeObserver.observe(doc.body);
      iframe.style.height = doc.body.scrollHeight + "px";
    }

    return () => resizeObserver.disconnect();
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
        sandbox="allow-same-origin allow-forms"
        className="w-full border-0"
        style={{ minHeight: "60px", display: "block" }}
        scrolling="no"
      />
    </div>
  );
}
