import type { RichTextBlockProps } from "@/lib/block-types";
import { TiptapEditor } from "@/components/TiptapEditor";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface Props {
  props: RichTextBlockProps;
  onChange: (props: RichTextBlockProps) => void;
}

function isHtmlEmpty(html: string): boolean {
  return !html || html.replace(/<[^>]*>/g, "").trim() === "";
}

export function RichTextPanel({ props, onChange }: Props) {
  const empty = isHtmlEmpty(props.html);
  return (
    <div className="space-y-4">
      {empty && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
          <p className="text-xs leading-relaxed">
            <strong>Content required.</strong> This block will break if saved empty. Add some text, or delete the block. Need blank space instead? Use a <strong>Spacer</strong> block.
          </p>
        </div>
      )}
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
