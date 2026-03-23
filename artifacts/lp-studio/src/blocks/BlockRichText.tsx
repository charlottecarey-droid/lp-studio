import type { RichTextBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: RichTextBlockProps;
  brand: BrandConfig;
}

export function BlockRichText({ props }: Props) {
  if (!props.html || props.html === "<p></p>") {
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
          "[&_a]:text-blue-600 [&_a]:underline",
          "[&_hr]:my-6 [&_strong]:font-bold [&_em]:italic [&_u]:underline",
          // images
          "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-4",
          // youtube / iframe embeds
          "[&_iframe]:w-full [&_iframe]:rounded [&_iframe]:my-4",
          "[&_.tiptap-youtube-iframe]:aspect-video [&_.tiptap-youtube-iframe]:w-full [&_.tiptap-youtube-iframe]:rounded [&_.tiptap-youtube-iframe]:my-4",
          "[&_[data-youtube-video]]:relative [&_[data-youtube-video]]:pb-[56.25%] [&_[data-youtube-video]]:h-0 [&_[data-youtube-video]]:overflow-hidden [&_[data-youtube-video]]:my-4 [&_[data-youtube-video]]:rounded",
          "[&_[data-youtube-video]_iframe]:absolute [&_[data-youtube-video]_iframe]:inset-0 [&_[data-youtube-video]_iframe]:w-full [&_[data-youtube-video]_iframe]:h-full",
          // column tables (borderless equal-width grid)
          "[&_table.column-table]:w-full [&_table.column-table]:border-0 [&_table.column-table]:table-fixed [&_table.column-table]:my-4",
          "[&_table.column-table_td]:border-0 [&_table.column-table_td]:align-top [&_table.column-table_td]:p-3",
          "[&_table.column-table_td:first-child]:pr-6",
          // regular tables (with borders)
          "[&_table:not(.column-table)]:w-full [&_table:not(.column-table)]:border-collapse [&_table:not(.column-table)]:my-4",
          "[&_table:not(.column-table)_td]:border [&_table:not(.column-table)_td]:border-gray-300 [&_table:not(.column-table)_td]:p-2",
          "[&_table:not(.column-table)_th]:border [&_table:not(.column-table)_th]:border-gray-300 [&_table:not(.column-table)_th]:p-2 [&_table:not(.column-table)_th]:bg-gray-100",
        ].join(" ")}
        dangerouslySetInnerHTML={{ __html: props.html }}
      />
    </div>
  );
}
