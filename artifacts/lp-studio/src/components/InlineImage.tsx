import { useState, ImgHTMLAttributes, CSSProperties } from "react";
import { ImageIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ImagePicker } from "@/components/ImagePicker";
import { cn } from "@/lib/utils";

interface InlineImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "onChange"> {
  src: string;
  alt: string;
  onUpdate?: (url: string) => void;
  className?: string;
  style?: CSSProperties;
  /** Optional wrapper className applied to the relative positioning shell. */
  wrapperClassName?: string;
}

export function InlineImage({
  src,
  alt,
  onUpdate,
  className,
  style,
  wrapperClassName,
  ...imgProps
}: InlineImageProps) {
  const [open, setOpen] = useState(false);

  if (!onUpdate) {
    return (
      <img src={src} alt={alt} className={className} style={style} {...imgProps} />
    );
  }

  return (
    <span
      className={cn("relative inline-block group", wrapperClassName)}
      style={{ lineHeight: 0 }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <img src={src} alt={alt} className={className} style={style} {...imgProps} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Replace image"
            className={cn(
              "absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white shadow",
              "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            )}
          >
            <ImageIcon className="w-3 h-3" />
            Replace
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-80"
          onClick={(e) => e.stopPropagation()}
        >
          <ImagePicker
            value={src}
            onChange={(url) => {
              onUpdate(url);
              setOpen(false);
            }}
            label="Replace image"
          />
        </PopoverContent>
      </Popover>
    </span>
  );
}
