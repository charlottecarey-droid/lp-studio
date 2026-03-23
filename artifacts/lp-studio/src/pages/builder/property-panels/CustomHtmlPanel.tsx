import type { CustomHtmlBlockProps } from "@/lib/block-types";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  props: CustomHtmlBlockProps;
  onChange: (props: CustomHtmlBlockProps) => void;
}

export function CustomHtmlPanel({ props, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">HTML Code</Label>
        <Textarea
          value={props.html}
          onChange={(e) => onChange({ ...props, html: e.target.value })}
          placeholder="<div>Paste your HTML here...</div>"
          className="font-mono text-xs min-h-[240px] resize-y"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Raw HTML rendered directly on the page. Scripts are not executed in the editor preview.
        </p>
      </div>
    </div>
  );
}
