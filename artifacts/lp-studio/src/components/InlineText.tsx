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
import { motion } from "framer-motion";
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
import { InlineColorPopover } from "@/components/InlineColorPopover";

interface InternalPageRef {
  id: number;
  title: string;
  slug: string;
}

// Cached promise for the internal-page list — fetched once per session and
// reused by every InlineText link popover. Keeps the autocomplete fast and
// avoids hammering /api/lp/pages on each link edit.
let pagesCache: Promise<InternalPageRef[]> | null = null;
function fetchInternalPages(): Promise<InternalPageRef[]> {
  if (!pagesCache) {
    pagesCache = fetch("/api/lp/pages")
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : []))
      .then((rows) => {
        if (!Array.isArray(rows)) return [];
        return rows
          .map((r) => {
            const o = r as Record<string, unknown>;
            return {
              id: Number(o.id ?? 0),
              title: String(o.title ?? ""),
              slug: String(o.slug ?? ""),
            };
          })
          .filter((p) => p.id > 0 && p.slug !== "");
      })
      .catch(() => []);
  }
  return pagesCache;
}

interface InlineTextAnimate {
  y?: number;
  delay?: number;
  duration?: number;
}

interface InlineTextProps {
  value: string;
  onUpdate?: (value: string) => void;
  className?: string;
  multiline?: boolean;
  as?: ElementType;
  style?: React.CSSProperties;
  /**
   * Optional subtle entrance animation applied only on the read-only render
   * path (when `onUpdate` is not provided). Edit mode skips animation so
   * click-to-edit and selection are never blocked by an in-flight transform.
   */
  animate?: InlineTextAnimate;
}

// The picker's "Brand" swatches are sourced from the tenant's live brand CSS
// variables (resolved to real hex below) so they reflect the actual palette
// rather than a generic rainbow. Each carries a fallback hex used only when the
// variable isn't present in scope (e.g. a non-branded preview).
const BRAND_SWATCH_TOKENS: ReadonlyArray<{
  name: string;
  cssVar: string;
  fallback: string;
}> = [
  { name: "Brand", cssVar: "--brand-primary", fallback: "#0f172a" },
  { name: "Accent", cssVar: "--brand-accent", fallback: "#3b82f6" },
  { name: "Text", cssVar: "--brand-text", fallback: "#1a1a1a" },
];

// Universal neutrals every text-color picker needs for legibility.
const NEUTRAL_SWATCHES: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Ink", value: "#0F172A" },
  { name: "Gray", value: "#64748B" },
  { name: "White", value: "#FFFFFF" },
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
  animate,
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
    // If focus has moved into a toolbar popover (e.g. the user clicked into the
    // color picker's hex input), the contentEditable selection collapses and
    // would otherwise tear down the toolbar — closing the popover mid-edit.
    // Keep the toolbar mounted while focus lives inside one of THIS toolbar's
    // surfaces. We scope strictly to [data-inline-toolbar] (the color/link
    // popover content and inline menus all carry it) so focus in unrelated
    // Radix popovers elsewhere in the app can't pin the toolbar open.
    const active = document.activeElement as HTMLElement | null;
    if (active && active.closest?.("[data-inline-toolbar]")) {
      return;
    }
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

  // Saved Range for the link popover so we don't lose the selection when the
  // popover opens (focus moves out of the contentEditable).
  const savedRangeRef = useRef<Range | null>(null);
  const [linkPopover, setLinkPopover] = useState<{ url: string; newTab: boolean } | null>(null);
  const [internalPages, setInternalPages] = useState<InternalPageRef[]>([]);
  useEffect(() => {
    if (linkPopover && internalPages.length === 0) {
      fetchInternalPages().then(setInternalPages).catch(() => {});
    }
  }, [linkPopover, internalPages.length]);

  const openLinkPopover = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    let node: Node | null = sel.anchorNode;
    let existing: HTMLAnchorElement | null = null;
    while (node && node !== editableRef.current) {
      if ((node as HTMLElement).tagName === "A") {
        existing = node as HTMLAnchorElement;
        break;
      }
      node = node.parentNode;
    }
    setLinkPopover({
      url: existing?.getAttribute("href") ?? "",
      newTab: existing?.getAttribute("target") === "_blank",
    });
  };

  const restoreSelection = () => {
    const r = savedRangeRef.current;
    if (!r) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(r);
  };

  const applyLink = () => {
    if (!linkPopover) return;
    restoreSelection();
    const url = linkPopover.url.trim();
    if (url === "") {
      execCmd("unlink");
    } else {
      execCmd("createLink", url);
      const sel = window.getSelection();
      const refreshed = sel?.anchorNode?.parentElement?.closest("a");
      if (refreshed) {
        if (linkPopover.newTab) {
          refreshed.setAttribute("target", "_blank");
          refreshed.setAttribute("rel", "noopener noreferrer");
        } else {
          refreshed.removeAttribute("target");
          refreshed.removeAttribute("rel");
        }
      }
    }
    setLinkPopover(null);
  };

  const handleLink = openLinkPopover;

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

  // Save the active selection just before the color popover opens. Opening a
  // Radix popover moves focus into the portaled content, which collapses the
  // browser selection inside the contentEditable. We restore it before
  // wrapping so the chosen swatch actually paints the user's highlighted run.
  const savedColorRangeRef = useRef<Range | null>(null);
  // Brand swatches resolved to real hex. The toolbar is portaled to <body>
  // (outside the brand-scoped wrapper), so `var(--brand-*)` won't resolve
  // there — but the contentEditable element IS inside brand scope, so we read
  // the live values from it when the picker opens.
  const [colorSwatches, setColorSwatches] = useState<
    { name: string; value: string }[]
  >([]);
  const resolveBrandSwatches = useCallback((): { name: string; value: string }[] => {
    const el = editableRef.current;
    const cs = el ? window.getComputedStyle(el) : null;
    const brand = BRAND_SWATCH_TOKENS.map((t) => {
      const resolved = cs?.getPropertyValue(t.cssVar).trim();
      return {
        name: t.name,
        value: resolved && resolved.length > 0 ? resolved : t.fallback,
      };
    });
    return [...brand, ...NEUTRAL_SWATCHES];
  }, []);
  const handleColorOpenChange = (next: boolean) => {
    if (next) {
      setColorSwatches(resolveBrandSwatches());
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        savedColorRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    }
    setOpenMenu(next ? "color" : null);
  };
  const handleColor = (colorValue: string) => {
    if (!colorValue) {
      setOpenMenu(null);
      savedColorRangeRef.current = null;
      return;
    }
    const saved = savedColorRangeRef.current;
    if (saved) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(saved);
      }
    }
    wrapSelectionWithSpan(`color: ${colorValue}`);
    savedColorRangeRef.current = null;
    setOpenMenu(null);
  };

  const [openMenu, setOpenMenu] = useState<"size" | "color" | null>(null);

  // Wrap long unbroken tokens (URLs, glued strings, etc.) so the surface
  // never extends past its container — both in read and edit mode.
  const wrapStyle: React.CSSProperties = {
    whiteSpace: "pre-line",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    maxWidth: "100%",
  };

  // Read-only render path (no onUpdate) — also used when isEditing is false.
  if (!onUpdate) {
    const baseStyle: React.CSSProperties = { ...wrapStyle, ...style };
    if (animate) {
      const MotionTag = motion.create(Tag as React.ComponentType<Record<string, unknown>>);
      const motionProps = {
        initial: { opacity: 0, y: animate.y ?? 12 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-10% 0px" },
        transition: {
          duration: animate.duration ?? 0.6,
          delay: animate.delay ?? 0,
          ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
        },
      };
      if (renderedHtml && isLikelyHtml(value)) {
        return (
          <MotionTag
            {...motionProps}
            className={className}
            style={baseStyle}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        );
      }
      return (
        <MotionTag {...motionProps} className={className} style={baseStyle}>
          {value}
        </MotionTag>
      );
    }
    if (renderedHtml && isLikelyHtml(value)) {
      return (
        <Tag
          className={className}
          style={baseStyle}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      );
    }
    return (
      <Tag className={className} style={baseStyle}>
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
          style={{ ...wrapStyle, ...style }}
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
        style={{ ...wrapStyle, ...style }}
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
  // Always allow wrapping (`pre-wrap`) so long tokens and edited text never
  // overflow the canvas. Single-line mode is enforced by Enter committing
  // instead of inserting a newline (see onKeyDown below).
  const editableStyle: React.CSSProperties = {
    ...style,
    outline: "2px solid hsl(var(--primary) / 0.6)",
    outlineOffset: 2,
    borderRadius: 4,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    maxWidth: "100%",
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
          // Don't commit if focus moved to the toolbar or to any popover that
          // the toolbar opened (color picker, link editor, font-size menu).
          // Radix portals popover content to <body> with
          // [data-radix-popper-content-wrapper], so we have to recognise that
          // marker too — otherwise opening the color picker blurs the editor,
          // commits, and the picker unmounts before the user can click a swatch.
          const next = e.relatedTarget as Node | null;
          if (next) {
            const el = next as HTMLElement;
            if (
              el.closest?.("[data-inline-toolbar]") ||
              el.closest?.("[data-radix-popper-content-wrapper]")
            ) {
              return;
            }
          }
          commit();
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
          if (e.key === "Enter") {
            // Shift+Enter always inserts a soft break (lets users add line
            // breaks even in single-line fields). Plain Enter inserts a
            // newline in multiline mode and commits in single-line mode.
            if (e.shiftKey) {
              e.preventDefault();
              execCmd("insertLineBreak");
            } else if (!multiline) {
              e.preventDefault();
              commit();
            }
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
            <InlineColorPopover
              open={openMenu === "color"}
              onOpenChange={handleColorOpenChange}
              onPick={(value) => handleColor(value)}
              brandSwatches={colorSwatches}
            >
              <button
                type="button"
                onMouseDown={onToolbarMouseDown}
                title="Text color"
                className="p-1.5 rounded hover:bg-accent text-popover-foreground"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </InlineColorPopover>
          </div>,
          document.body
        )}
      {linkPopover &&
        toolbarPos &&
        createPortal(
          <div
            data-inline-toolbar
            onMouseDown={onToolbarMouseDown}
            style={{
              position: "fixed",
              top: toolbarPos.top + 36,
              left: toolbarPos.left,
              transform: "translate(-50%, 0)",
              zIndex: 10000,
            }}
            className="flex flex-col gap-1.5 rounded-md border border-border bg-popover p-2 shadow-xl min-w-[18rem]"
          >
            <input
              autoFocus
              type="text"
              value={linkPopover.url}
              onChange={(e) => setLinkPopover({ ...linkPopover, url: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setLinkPopover(null);
                }
              }}
              placeholder="https://, /slug, mailto:, tel:, #anchor — or search a page"
              className="text-xs px-2 py-1.5 rounded border border-border bg-background text-foreground"
            />
            {(() => {
              const q = linkPopover.url.trim().toLowerCase();
              const isExternal = /^(https?:|mailto:|tel:|#)/i.test(q);
              if (q.length === 0 || isExternal) return null;
              const matches = internalPages
                .filter(
                  (p) =>
                    p.title.toLowerCase().includes(q) ||
                    p.slug.toLowerCase().includes(q),
                )
                .slice(0, 5);
              if (matches.length === 0) return null;
              return (
                <div className="border border-border rounded-md max-h-40 overflow-y-auto">
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        setLinkPopover({ ...linkPopover, url: `/${p.slug}` })
                      }
                      className="w-full text-left px-2 py-1.5 hover:bg-accent text-[11px] flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{p.title}</span>
                      <span className="text-muted-foreground/70 text-[10px] shrink-0">
                        /{p.slug}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}
            <label className="flex items-center gap-1.5 text-[11px] text-popover-foreground">
              <input
                type="checkbox"
                checked={linkPopover.newTab}
                onChange={(e) => setLinkPopover({ ...linkPopover, newTab: e.target.checked })}
              />
              Open in new tab
            </label>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setLinkPopover(null)}
                className="text-[11px] px-2 py-1 rounded hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyLink}
                className="text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Apply
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
