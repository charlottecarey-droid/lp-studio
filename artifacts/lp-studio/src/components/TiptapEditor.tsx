import { useEditor, EditorContent, Extension, Node as TiptapNode, type CommandProps, ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Image } from "@tiptap/extension-image";
import { Youtube } from "@tiptap/extension-youtube";
import { TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { useEffect, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, Minus, Undo, Redo,
  ImageIcon, Video, Columns2, Highlighter, ChevronDown, Library,
} from "lucide-react";
import { MediaLibraryDrawer } from "@/components/MediaLibraryDrawer";

declare module "@tiptap/extension-text-style" {
  interface TextStyleAttributes {
    fontSize?: string | null;
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    videoEmbed: {
      setVideoEmbed: (attrs: { src: string; title?: string }) => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            renderHTML(attributes: Record<string, unknown>) {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize as string}` };
            },
            parseHTML(element: HTMLElement) {
              return element.style.fontSize || null;
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ commands }: CommandProps) =>
          commands.setMark("textStyle", { fontSize }),
      unsetFontSize:
        () =>
        ({ commands }: CommandProps) =>
          commands.setMark("textStyle", { fontSize: null }),
    };
  },
});

const VideoEmbed = TiptapNode.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      title: { default: "Video" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-video-embed]" }];
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string> }) {
    return [
      "div",
      {
        "data-video-embed": "true",
        style:
          "position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1rem 0;border-radius:8px",
      },
      [
        "iframe",
        {
          src: HTMLAttributes.src ?? "",
          title: HTMLAttributes.title ?? "Video",
          style:
            "position:absolute;top:0;left:0;width:100%;height:100%;border:0",
          allowfullscreen: "true",
          allow: "autoplay; fullscreen; picture-in-picture",
        },
      ],
    ];
  },
  addCommands() {
    return {
      setVideoEmbed:
        (attrs: { src: string; title?: string }) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: "videoEmbed", attrs }),
    };
  },
  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText =
        "position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1rem 0;border-radius:8px;background:#000";
      const iframe = document.createElement("iframe");
      iframe.src = (node.attrs as { src: string; title?: string }).src ?? "";
      iframe.title = (node.attrs as { src: string; title?: string }).title ?? "Video";
      iframe.style.cssText =
        "position:absolute;top:0;left:0;width:100%;height:100%;border:0";
      iframe.setAttribute("allowfullscreen", "true");
      iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
      wrapper.appendChild(iframe);
      return { dom: wrapper };
    };
  },
});

// ─── Resizable Image ────────────────────────────────────────────────────────

function ResizableImageView({ node, updateAttributes, selected }: {
  node: { attrs: { src: string; alt?: string; width?: string; align?: string } };
  updateAttributes: (attrs: Record<string, string | null>) => void;
  selected: boolean;
  deleteNode: () => void;
}) {
  const widths = ["25%", "50%", "75%", "100%"];
  const aligns = [
    { value: "left", label: "⬅" },
    { value: "center", label: "⬛" },
    { value: "right", label: "➡" },
  ];
  const wrapAlign = node.attrs.align === "center" ? "mx-auto" : node.attrs.align === "right" ? "ml-auto" : "";

  return (
    <NodeViewWrapper className="relative inline-block w-full my-2">
      <div
        className={cn(
          "relative group inline-block",
          wrapAlign,
          selected ? "ring-2 ring-primary ring-offset-1 rounded" : ""
        )}
        style={{ width: node.attrs.width || "100%", maxWidth: "100%" }}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || ""}
          className="block w-full h-auto rounded"
          draggable={false}
        />
        {selected && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 p-1 bg-black/70 rounded-b">
            {widths.map(w => (
              <button
                key={w}
                type="button"
                onClick={() => updateAttributes({ width: w })}
                className={cn(
                  "px-2 py-0.5 text-[10px] rounded font-medium transition-colors",
                  (node.attrs.width || "100%") === w
                    ? "bg-primary text-white"
                    : "bg-white/20 text-white hover:bg-white/40"
                )}
              >
                {w}
              </button>
            ))}
            <div className="w-px h-3 bg-white/30 mx-0.5" />
            {aligns.map(a => (
              <button
                key={a.value}
                type="button"
                onClick={() => updateAttributes({ align: a.value })}
                className={cn(
                  "px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors",
                  (node.attrs.align || "left") === a.value
                    ? "bg-primary text-white"
                    : "bg-white/20 text-white hover:bg-white/40"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: "100%", parseHTML: el => el.style.width || el.getAttribute("width") || "100%" },
      align: { default: "left", parseHTML: el => el.getAttribute("data-align") || "left" },
    };
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const { width, align, ...rest } = HTMLAttributes;
    return [
      "img",
      {
        ...rest,
        style: `width:${width as string};max-width:100%;display:block;${align === "center" ? "margin:0 auto;" : align === "right" ? "margin-left:auto;" : ""}`,
        "data-align": align,
      },
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView as unknown as any);
  },
});

const FONT_SIZES = [
  { label: "XS", value: "0.75rem" },
  { label: "SM", value: "0.875rem" },
  { label: "Base", value: "1rem" },
  { label: "LG", value: "1.125rem" },
  { label: "XL", value: "1.25rem" },
  { label: "2XL", value: "1.5rem" },
  { label: "3XL", value: "1.875rem" },
];

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}

function ToolbarButton({ onClick, active, title, children, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={cn(
        "p-1.5 rounded text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  showToolbar?: boolean;
  onBlur?: () => void;
}

export function TiptapEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  className,
  editable = true,
  showToolbar = true,
  onBlur,
}: TiptapEditorProps) {
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const highlightColorRef = useRef<HTMLInputElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      ResizableImage.configure({
        HTMLAttributes: { class: "max-w-full h-auto rounded" },
      }),
      Youtube.configure({ width: 640, height: 360 }),
      TextStyle,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      VideoEmbed,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: () => onBlur?.(),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none min-h-[80px] px-3 py-2",
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2",
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2",
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-1",
          "[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-primary [&_a]:underline",
          "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2",
          "[&_table]:w-full [&_table]:border-collapse",
          "[&_td]:p-2 [&_td]:align-top [&_th]:p-2 [&_th]:align-top",
          "[&_table.column-table_td]:border-0 [&_table.column-table]:border-0",
        ),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== content) editor.commands.setContent(content);
  }, [content, editor]);

  useEffect(() => {
    if (!showFontSizeMenu) return;
    const handler = (e: MouseEvent) => {
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(e.target as Node)) {
        setShowFontSizeMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFontSizeMenu]);

  useEffect(() => {
    if (!showImagePanel) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowImagePanel(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showImagePanel]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const insertVideo = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Paste a YouTube or Vimeo URL:", "");
    if (!url || !url.trim()) return;
    const trimmed = url.trim();

    const isYoutube = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)/.test(trimmed);
    if (isYoutube) {
      const ok = editor.chain().focus().setYoutubeVideo({ src: trimmed }).run();
      if (!ok) alert("Could not embed video. Please check the YouTube URL.");
      return;
    }

    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      const embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      editor.chain().focus().setVideoEmbed({ src: embedUrl, title: "Vimeo video" }).run();
      return;
    }

    alert("Please enter a valid YouTube or Vimeo URL.");
  }, [editor]);

  const insertImageByUrl = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setImageUrl("");
    setShowImagePanel(false);
  }, [editor, imageUrl]);

  const handleImageFileUpload = useCallback(async (file: File) => {
    if (!editor) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/lp/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };
      editor.chain().focus().setImage({ src: `/api/storage${url}` }).run();
      setShowImagePanel(false);
    } catch {
      alert("Image upload failed. Try pasting a URL instead.");
    } finally {
      setImageUploading(false);
    }
  }, [editor]);

  const insertColumns = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 1, cols: 2, withHeaderRow: false }).run();
  }, [editor]);

  const currentFontSize = editor?.getAttributes("textStyle")?.fontSize as string | undefined;

  if (!editor) return null;

  return (
    <div className={cn("border border-input rounded-md overflow-hidden bg-background", className)}>
      {showToolbar && editable && (
        <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-input bg-muted/30">

          {/* Headings */}
          <ToolbarButton title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* Formatting */}
          <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>
            <LinkIcon className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* Lists */}
          <ToolbarButton title="Bullet List" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Numbered List" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* Alignment */}
          <ToolbarButton title="Align Left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Align Center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Align Right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* Font Size */}
          <div className="relative" ref={fontSizeMenuRef}>
            <button
              type="button"
              title="Font Size"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowFontSizeMenu(v => !v); }}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors h-[28px]"
            >
              <span className="min-w-[22px] text-center font-medium">
                {currentFontSize ? (FONT_SIZES.find(s => s.value === currentFontSize)?.label ?? "Aa") : "Aa"}
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFontSizeMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-input rounded shadow-md py-1 min-w-[110px]">
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  onClick={(e) => { e.preventDefault(); editor.chain().focus().unsetFontSize().run(); setShowFontSizeMenu(false); }}
                >
                  Default
                </button>
                {FONT_SIZES.map(size => (
                  <button
                    key={size.value}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex justify-between items-center gap-3",
                      currentFontSize === size.value ? "bg-muted font-semibold" : "text-foreground"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      editor.chain().focus().setFontSize(size.value).run();
                      setShowFontSizeMenu(false);
                    }}
                  >
                    <span>{size.label}</span>
                    <span className="text-muted-foreground text-[10px]">{size.value}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Highlight Color */}
          <div className="relative flex items-center gap-0.5">
            <button
              type="button"
              title="Highlight color — click to pick"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); highlightColorRef.current?.click(); }}
              className={cn(
                "p-1.5 rounded text-sm transition-colors",
                editor.isActive("highlight")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>
            <input
              ref={highlightColorRef}
              type="color"
              defaultValue="#fef08a"
              className="sr-only"
              onChange={(e) => { editor.chain().focus().setHighlight({ color: e.target.value }).run(); }}
            />
            {editor.isActive("highlight") && (
              <button
                type="button"
                title="Remove highlight"
                onClick={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); }}
                className="text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted leading-none"
              >
                ✕
              </button>
            )}
          </div>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* Insert Image */}
          <div className="relative">
            <ToolbarButton title="Insert Image" active={showImagePanel} onClick={() => setShowImagePanel(v => !v)}>
              <ImageIcon className="w-3.5 h-3.5" />
            </ToolbarButton>
            {showImagePanel && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-input rounded-md shadow-lg p-3 w-72">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Insert Image</p>
                <div className="flex gap-2 mb-2">
                  <input
                    autoFocus
                    type="url"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); insertImageByUrl(); } }}
                    placeholder="Paste image URL…"
                    className="flex-1 text-xs border border-input rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={insertImageByUrl}
                    disabled={!imageUrl.trim()}
                    className="text-xs px-2 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-40"
                  >
                    Insert
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowImagePanel(false); setShowMediaLibrary(true); }}
                  className="w-full text-xs border border-input rounded py-2 flex items-center justify-center gap-1.5 text-primary hover:bg-primary/5 transition-colors mb-2"
                >
                  <Library className="w-3 h-3" />
                  Browse Media Library
                </button>
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or upload</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <button
                  type="button"
                  disabled={imageUploading}
                  onClick={() => imageFileRef.current?.click()}
                  className="w-full text-xs border border-dashed border-input rounded py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                >
                  {imageUploading ? "Uploading…" : "Upload from computer"}
                </button>
                <input
                  ref={imageFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleImageFileUpload(f); }}
                />
              </div>
            )}
          </div>

          {/* Insert Video */}
          <ToolbarButton title="Embed YouTube / Vimeo video" onClick={insertVideo}>
            <Video className="w-3.5 h-3.5" />
          </ToolbarButton>

          {/* Insert Columns */}
          <ToolbarButton title="Insert 2-column layout" onClick={insertColumns}>
            <Columns2 className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* Horizontal Rule */}
          <ToolbarButton title="Horizontal Rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="flex-1" />

          {/* History */}
          <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
            <Undo className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
            <Redo className="w-3.5 h-3.5" />
          </ToolbarButton>

        </div>
      )}
      <EditorContent editor={editor} />

      {/* Media Library Drawer — opened from image insert panel */}
      <MediaLibraryDrawer
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        onSelect={url => {
          editor.chain().focus().setImage({ src: url }).run();
        }}
      />
    </div>
  );
}
