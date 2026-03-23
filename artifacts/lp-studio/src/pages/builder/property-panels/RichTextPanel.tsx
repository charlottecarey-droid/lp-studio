import type { RichTextBlockProps } from "@/lib/block-types";
import { TiptapEditor } from "@/components/TiptapEditor";
import { Label } from "@/components/ui/label";

interface Props {
  props: RichTextBlockProps;
  onChange: (props: RichTextBlockProps) => void;
}

export function RichTextPanel({ props, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">Content</Label>
        <TiptapEditor
          content={props.html}
          onChange={(html) => onChange({ ...props, html })}
          placeholder="Start writing your rich text content..."
          showToolbar={true}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Use the toolbar to format headings, bold, italic, lists, links, and more.
        </p>
      </div>
    </div>
  );
}
