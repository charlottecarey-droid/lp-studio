import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link2, ExternalLink, Check } from "lucide-react";

interface InternalPage {
  id: number;
  title: string;
  slug: string;
}

interface Props {
  /** Trigger element rendered as the popover's anchor. Must accept a ref via asChild. */
  children: React.ReactNode;
  initialUrl?: string;
  initialNewTab?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string, newTab: boolean) => void;
  onRemove?: () => void;
  /** Async page-list fetcher for internal-page autocomplete. Optional. */
  fetchPages?: () => Promise<InternalPage[]>;
}

export function InlineLinkPopover({
  children,
  initialUrl = "",
  initialNewTab = true,
  open,
  onOpenChange,
  onSubmit,
  onRemove,
  fetchPages,
}: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [newTab, setNewTab] = useState(initialNewTab);
  const [pages, setPages] = useState<InternalPage[]>([]);

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setNewTab(initialNewTab);
      if (fetchPages && pages.length === 0) {
        fetchPages().then(setPages).catch(() => {});
      }
    }
    // intentionally only re-run when the popover opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () => {
    onSubmit(url.trim(), newTab);
    onOpenChange(false);
  };

  const filteredPages = url.length > 0 && !url.startsWith("http") && !url.startsWith("mailto:") && !url.startsWith("tel:") && !url.startsWith("#")
    ? pages
        .filter(
          (p) =>
            p.title.toLowerCase().includes(url.toLowerCase()) ||
            p.slug.toLowerCase().includes(url.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 p-3"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Link
            </Label>
            <div className="flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://, /page-slug, mailto:, tel:, #anchor"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {filteredPages.length > 0 && (
            <div className="border border-border rounded-md max-h-40 overflow-y-auto">
              {filteredPages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setUrl(`/lp/${p.slug}`)}
                  className="w-full text-left px-2 py-1.5 hover:bg-muted text-xs flex items-center justify-between gap-2"
                >
                  <span className="truncate">{p.title}</span>
                  <span className="text-muted-foreground/70 text-[10px] shrink-0">/{p.slug}</span>
                </button>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={newTab}
              onChange={(e) => setNewTab(e.target.checked)}
              className="rounded border-border"
            />
            <ExternalLink className="w-3 h-3" />
            Open in new tab
          </label>

          <div className="flex items-center justify-between pt-1">
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onRemove();
                  onOpenChange(false);
                }}
                className="h-7 text-xs text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={submit}
              className="h-7 text-xs"
            >
              <Check className="w-3 h-3 mr-1" />
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
