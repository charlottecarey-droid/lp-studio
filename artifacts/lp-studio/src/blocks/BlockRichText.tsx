import type { RichTextBlockProps } from "@/lib/block-types";
import { BRAND_BODY_FONT } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
import type { BrandConfig } from "@/lib/brand-config";
import { sanitizeHtml } from "@/lib/sanitize";

interface Props {
  props: RichTextBlockProps;
  brand: BrandConfig;
}

export function BlockRichText({ props }: Props) {
  if (!props.html || props.html === "<p style={{ fontFamily: BODY }}></p>") {
    return (
      <div className="py-12 px-8 text-center text-muted-foreground text-sm italic">
        Rich text block — click to edit content
      </div>
    );
  }

  return (
    <div className="py-10 px-8">
      <div
        className={[
          "prose prose-lg max-w-4xl mx-auto",
          "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4",
          "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3",
          "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-2",
          "[&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1",
          // Links inherit the surrounding text color so they stay legible on
          // any section background. The brand-aware `--brand-link-on-light`
          // (and -on-dark) variables are picked up by blocks that explicitly
          // set their own link color; this block lives inside arbitrary prose
          // so `currentColor` is the safest default.
          "[&_a]:text-[currentColor] [&_a]:underline [&_a]:decoration-current/40 [&_a]:underline-offset-2",
          "[&_hr]:my-6 [&_strong]:font-bold [&_em]:italic [&_u]:underline",
          // inline images
          "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:my-4",
          // YouTube node wrapper: [data-youtube-video]
          "[&_[data-youtube-video]]:relative [&_[data-youtube-video]]:my-6 [&_[data-youtube-video]]:rounded-xl [&_[data-youtube-video]]:overflow-hidden",
          "[&_[data-youtube-video]_iframe]:w-full [&_[data-youtube-video]_iframe]:aspect-video [&_[data-youtube-video]_iframe]:border-0",
          // Vimeo VideoEmbed node wrapper: [data-video-embed]
          "[&_[data-video-embed]]:relative [&_[data-video-embed]]:pb-[56.25%] [&_[data-video-embed]]:h-0 [&_[data-video-embed]]:overflow-hidden [&_[data-video-embed]]:my-6 [&_[data-video-embed]]:rounded-xl",
          "[&_[data-video-embed]_iframe]:absolute [&_[data-video-embed]_iframe]:inset-0 [&_[data-video-embed]_iframe]:w-full [&_[data-video-embed]_iframe]:h-full [&_[data-video-embed]_iframe]:border-0",
          // Tiptap-generated tables (used for 2-column layouts): borderless, equal widths
          "[&_table]:w-full [&_table]:table-fixed [&_table]:border-0 [&_table]:border-collapse [&_table]:my-6",
          "[&_td]:border-0 [&_td]:align-top [&_td]:p-3 [&_td]:w-1/2",
          "[&_th]:border-0 [&_th]:align-top [&_th]:p-3 [&_th]:w-1/2",
          "[&_colgroup]:hidden",
        ].join(" ")}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(props.html) }}
      />
    </div>
  );
}
