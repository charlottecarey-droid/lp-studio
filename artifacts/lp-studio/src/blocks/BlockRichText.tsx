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
        className="prose prose-lg max-w-4xl mx-auto [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_a]:text-blue-600 [&_a]:underline [&_hr]:my-6 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
        dangerouslySetInnerHTML={{ __html: props.html }}
      />
    </div>
  );
}
