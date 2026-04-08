import { useEffect, useRef, useState, ElementType } from "react";
import { cn } from "@/lib/utils";

interface InlineTextProps {
  value: string;
  onUpdate?: (value: string) => void;
  className?: string;
  multiline?: boolean;
  as?: ElementType;
  style?: React.CSSProperties;
}

export function InlineText({
  value,
  onUpdate,
  className,
  multiline = false,
  as: Tag = "span",
  style,
}: InlineTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const commit = () => {
    onUpdate?.(draft);
    setIsEditing(false);
  };

  if (!onUpdate) {
    return (
      <Tag className={className} style={{ whiteSpace: "pre-line", ...style }}>
        {value}
      </Tag>
    );
  }

  if (isEditing) {
    const sharedStyle: React.CSSProperties = {
      ...style,
      display: "block",
      width: "100%",
      background: "transparent",
      border: "none",
      outline: "none",
      padding: 0,
      margin: 0,
      resize: "none",
      fontFamily: "inherit",
      fontSize: "inherit",
      fontWeight: "inherit",
      letterSpacing: "inherit",
      lineHeight: "inherit",
      color: "inherit",
      whiteSpace: "pre-line",
    };

    return (
      <span
        className={cn("relative inline-block w-full", className)}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            rows={Math.max(3, (draft.match(/\n/g) ?? []).length + 2)}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === "Escape") { setDraft(value); setIsEditing(false); }
            }}
            style={sharedStyle}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(value); setIsEditing(false); }
            }}
            style={sharedStyle}
          />
        )}
        <span className="absolute -bottom-5 left-0 text-[9px] bg-primary text-primary-foreground px-1 rounded whitespace-nowrap z-50 pointer-events-none">
          {multiline ? "Click outside to save" : "Enter or click outside to save"}
        </span>
      </span>
    );
  }

  return (
    <Tag
      className={cn(
        "cursor-text hover:outline-dashed hover:outline-2 hover:outline-primary/60 hover:outline-offset-1 rounded-sm transition-[outline]",
        className
      )}
      style={{ whiteSpace: "pre-line", ...style }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        setDraft(value);
        setIsEditing(true);
      }}
      title="Click to edit"
    >
      {value || <span style={{ opacity: 0.35 }}>Click to edit</span>}
    </Tag>
  );
}
