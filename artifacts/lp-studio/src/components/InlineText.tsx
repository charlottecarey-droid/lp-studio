import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  ElementType,
} from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Link2,
  Link2Off,
  Type,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  sanitizeInlineHtml,
  isLikelyHtml,
} from "@/lib/sanitize-inline-html";

interface InlineTextProps {
  value: string;
  onUpdate?: (value: string) => void;
  className?: string;
  multiline?: boolean;
  as?: ElementType;
  style?: React.CSSProperties;
}

const COLOR_SWATCHES: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Default", value: "" },
  { name: "Brand", value: "var(--brand-primary)" },
  { name: "Accent", value: "var(--brand-accent)" },
  { name: "Slate", value: "#0F172A" },
  { name: "Muted", value: "#64748B" },
  { name: "White", value: "#FFFFFF" },
  { name: "Blue", value: "#2563EB" },
  { name: "Green", value: "#16A34A" },
  { name: "Amber", value: "#D97706" },
  { name: "Rose", value: "#E11D48" },
];

const FONT_SIZES: ReadonlyArray<{ label: string; value: string }> = [
  { label: "Default", value: "" },
  { label: "S", value: "0.875em" },
  { label: "M", value: "1em" },
  { label: "L", value: "1.25em" },
  { label: "XL", value: "1.5em" },
  { label: "2XL", value: "2em" },
];

function execCmd(cmd: string, value?: string) {
  // execCommand is deprecated but still implemented in every shipping
  // browser and is dramatically simpler than reimplementing range surgery.
  document.execCommand(cmd, false, value);
}

function wrapSelectionWithSpan(styleDecl: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement("span");
  span.setAttribute("style", styleDecl);
  try {
    span.appendChild(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
  } catch {
    // Selection spanned non-extractable boundaries (e.g. across block
    // edges). Silently ignore — this is a contentEditable safety net.
  }
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
  const editableRef = useRef<HTMLElement | null>(null);
  const initialHtmlRef = useRef<string>(value);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const lastHtmlRef = useRef<string>(value);

  const renderedHtml = useMemo(() => {
    if (!value) return "";
    return isLikelyHtml(value) ? sanitizeInlineHtml(value) : value;
  }, [value]);

  // When not editing, mirror external value into our refs.
  useEffect(() => {
    if (!isEditing) {
      initialHtmlRef.current = value;
      lastHtmlRef.current = value;
    }
  }, [value, isEditing]);

  // Place the cursor at the end on entering edit mode, and seed the editor.
  // SECURITY: never assign raw value to innerHTML. If the value is HTML, run
  // it through the allowlist sanitizer first; otherwise seed via textContent
  // so that stored payloads like `<img onerror=...>` cannot be instantiated.
  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = editableRef.current;
    if (!el) return;
    if (isLikelyHtml(value)) {
      el.innerHTML = sanitizeInlineHtml(value);
    } else {
      el.textContent = value;
    }
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [isEditing, value]);

  const updateToolbarFromSelection = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setToolbarPos(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) {
      setToolbarPos(null);
      return;
    }
    if (sel.isCollapsed) {
      setToolbarPos(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setToolbarPos(null);
      return;
    }
    setToolbarPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    const handler = () => updateToolbarFromSelection();
    document.addEventListener("selectionchange", handler);
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      document.removeEventListener("selectionchange", handler);
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [isEditing, updateToolbarFromSelection]);

  const commit = useCallback(() => {
    const el = editableRef.current;
    if (!el) {
      setIsEditing(false);
      return;
    }
    // If the user didn't add any formatting, persist the raw text instead of
    // sanitized HTML — otherwise plain values like "AT&T" get escaped to
    // "AT&amp;T" through the parse/serialize round-trip and oscillate on
    // every blur.
    const hasFormattingTag =
      el.querySelector("strong, b, em, i, u, a, span, br") !== null;
    let next: string;
    if (!hasFormattingTag) {
      next = el.textContent ?? "";
    } else {
      next = sanitizeInlineHtml(el.innerHTML);
    }
    setIsEditing(false);
    setToolbarPos(null);
    if (next !== initialHtmlRef.current) {
      onUpdate?.(next);
    }
  }, [onUpdate]);

  const cancel = useCallback(() => {
    setIsEditing(false);
    setToolbarPos(null);
  }, []);

  // Handlers that act on the current selection. We use mousedown.preventDefault
  // on the toolbar to avoid stealing focus from the contentEditable; otherwise
  // the selection collapses before the command fires.
  const onToolbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleBold = () => execCmd("bold");
  const handleItalic = () => execCmd("italic");

  const handleLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    // Detect existing anchor in selection
    let node: Node | null = sel.anchorNode;
    let existing: HTMLAnchorElement | null = null;
    while (node && node !== editableRef.current) {
      if ((node as HTMLElement).tagName === "A") {
        existing = node as HTMLAnchorElement;
        break;
      }
      node = node.parentNode;
    }
    const current = existing?.getAttribute("href") ?? "";
    const url = window.prompt("Link URL (https://, mailto:, tel:, /, #...)", current);
    if (url == null) return;
    if (url.trim() === "") {
      execCmd("unlink");
      return;
    }
    execCmd("createLink", url.trim());
    // Decorate the freshly-created link with target/rel.
    const refreshed = sel.anchorNode?.parentElement?.closest("a");
    if (refreshed) {
      refreshed.setAttribute("target", "_blank");
      refreshed.setAttribute("rel", "noopener noreferrer");
    }
  };

  const handleUnlink = () => execCmd("unlink");

  const handleFontSize = (sizeValue: string) => {
    if (!sizeValue) {
      // Strip inline font-size in selection by wrapping with empty span.
      // Simplest: do nothing — users can re-select and pick a real size.
      return;
    }
    wrapSelectionWithSpan(`font-size: ${sizeValue}`);
    setOpenMenu(null);
  };

  const handleColor = (colorValue: string) => {
    if (!colorValue) {
      setOpenMenu(null);
      return;
    }
    wrapSelectionWithSpan(`color: ${colorValue}`);
    setOpenMenu(null);
  };

  const [openMenu, setOpenMenu] = useState<"size" | "color" | null>(null);

  // Read-only render path (no onUpdate) — also used when isEditing is false.
  if (!onUpdate) {
    if (renderedHtml && isLikelyHtml(value)) {
      return (
        <Tag
          className={className}
          style={{ whiteSpace: "pre-line", ...style }}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      );
    }
    return (
      <Tag className={className} style={{ whiteSpace: "pre-line", ...style }}>
        {value}
      </Tag>
    );
  }

  if (!isEditing) {
    const baseClass = cn(
      "cursor-text hover:outline-dashed hover:outline-2 hover:outline-primary/60 hover:outline-offset-1 rounded-sm transition-[outline]",
      className
    );
    if (renderedHtml && isLikelyHtml(value)) {
      return (
        <Tag
          className={baseClass}
          style={{ whiteSpace: "pre-line", ...style }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          title="Click to edit"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      );
    }
    return (
      <Tag
        className={baseClass}
        style={{ whiteSpace: "pre-line", ...style }}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        title="Click to edit"
      >
        {value || <span style={{ opacity: 0.35 }}>Click to edit</span>}
      </Tag>
    );
  }

  // Editing mode — contentEditable with floating toolbar in portal.
  const editableStyle: React.CSSProperties = {
    ...style,
    outline: "2px solid hsl(var(--primary) / 0.6)",
    outlineOffset: 2,
    borderRadius: 4,
    whiteSpace: multiline ? "pre-wrap" : "nowrap",
    minHeight: "1em",
  };

  return (
    <>
      <Tag
        ref={editableRef as React.Ref<HTMLElement>}
        className={cn(className)}
        style={editableStyle}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        onBlur={(e: React.FocusEvent) => {
          // Don't commit if focus moved to the toolbar.
          const next = e.relatedTarget as Node | null;
          if (next && (next as HTMLElement).closest?.("[data-inline-toolbar]")) {
            return;
          }
          commit();
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
          if (!multiline && e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            handleBold();
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
            e.preventDefault();
            handleItalic();
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            handleLink();
          }
        }}
        onInput={() => {
          const el = editableRef.current;
          if (el) lastHtmlRef.current = el.innerHTML;
        }}
      />
      {toolbarPos &&
        createPortal(
          <div
            data-inline-toolbar
            onMouseDown={onToolbarMouseDown}
            style={{
              position: "fixed",
              top: toolbarPos.top,
              left: toolbarPos.left,
              transform: "translate(-50%, -100%)",
              zIndex: 9999,
            }}
            className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-lg"
          >
            <button
              type="button"
              onMouseDown={onToolbarMouseDown}
              onClick={handleBold}
              title="Bold (⌘B)"
              className="p-1.5 rounded hover:bg-accent text-popover-foreground"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={onToolbarMouseDown}
              onClick={handleItalic}
              title="Italic (⌘I)"
              className="p-1.5 rounded hover:bg-accent text-popover-foreground"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={onToolbarMouseDown}
              onClick={handleLink}
              title="Link (⌘K)"
              className="p-1.5 rounded hover:bg-accent text-popover-foreground"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={onToolbarMouseDown}
              onClick={handleUnlink}
              title="Remove link"
              className="p-1.5 rounded hover:bg-accent text-popover-foreground"
            >
              <Link2Off className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-border mx-0.5" />
            <div className="relative">
              <button
                type="button"
                onMouseDown={onToolbarMouseDown}
                onClick={() => setOpenMenu(openMenu === "size" ? null : "size")}
                title="Font size"
                className="p-1.5 rounded hover:bg-accent text-popover-foreground"
              >
                <Type className="w-3.5 h-3.5" />
              </button>
              {openMenu === "size" && (
                <div
                  className="absolute top-full left-0 mt-1 rounded-md border border-border bg-popover p-1 shadow-lg flex flex-col min-w-[6rem]"
                  onMouseDown={onToolbarMouseDown}
                >
                  {FONT_SIZES.map(s => (
                    <button
                      key={s.label}
                      type="button"
                      onMouseDown={onToolbarMouseDown}
                      onClick={() => handleFontSize(s.value)}
                      className="text-left text-xs px-2 py-1 rounded hover:bg-accent text-popover-foreground"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onMouseDown={onToolbarMouseDown}
                onClick={() => setOpenMenu(openMenu === "color" ? null : "color")}
                title="Text color"
                className="p-1.5 rounded hover:bg-accent text-popover-foreground"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
              {openMenu === "color" && (
                <div
                  className="absolute top-full left-0 mt-1 rounded-md border border-border bg-popover p-1.5 shadow-lg grid grid-cols-5 gap-1"
                  onMouseDown={onToolbarMouseDown}
                >
                  {COLOR_SWATCHES.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      onMouseDown={onToolbarMouseDown}
                      onClick={() => handleColor(c.value)}
                      className="w-5 h-5 rounded border border-border"
                      style={{
                        background: c.value || "transparent",
                        backgroundImage: c.value
                          ? undefined
                          : "linear-gradient(45deg, transparent 45%, currentColor 45%, currentColor 55%, transparent 55%)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
