import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Node as TiptapNode } from "@tiptap/core";
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Bold, Italic, Link as LinkIcon, List, Heading1, Heading2,
  Minus, RemoveFormatting, Globe, Image as ImageIcon, Columns,
  FileText, Code, AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";

/* ── Merge Variable Extension ── */
const MergeVariable = TiptapNode.create({
  name: "mergeVariable",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      variable: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-merge-variable"),
        renderHTML: (attributes) => ({
          "data-merge-variable": attributes.variable,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-variable]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        "data-merge-variable": HTMLAttributes.variable,
        style:
          "background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:4px;font-size:13px;font-family:monospace;user-select:all;",
      },
      `{{${HTMLAttributes.variable ?? ""}}}`,
    ];
  },
});

/* ── Types ── */
export interface EmailEditorHandle {
  getHTML: () => string;
  setContent: (html: string) => void;
  isEmpty: () => boolean;
}

interface EmailWYSIWYGEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  dandyBannerUrl: string;
}

/* ── Toolbar Button ── */
const ToolbarBtn = ({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

/* ── Link Popover ── */
const LinkPopover = ({ editor }: { editor: Editor }) => {
  const [url, setUrl] = useState("https://");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  const handleInsert = () => {
    if (!url.trim()) {
      toast.error("URL is required");
      return;
    }
    const linkText = text.trim() || url.trim();
    editor
      .chain()
      .focus()
      .insertContent(`<a href="${url.trim()}">${linkText}</a>`)
      .run();
    setUrl("https://");
    setText("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          title="Insert Link"
          className={`p-1.5 rounded transition-colors ${
            editor.isActive("link")
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <LinkIcon className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3" align="start">
        <div>
          <label className="text-[11px] text-muted-foreground mb-0.5 block">
            Link Text
          </label>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Click here"
            className="text-sm h-8"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-0.5 block">
            URL
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="text-sm h-8"
          />
        </div>
        <Button size="sm" onClick={handleInsert} className="w-full h-7 text-xs">
          Insert Link
        </Button>
      </PopoverContent>
    </Popover>
  );
};

/* ── Image Popover ── */
const ImagePopover = ({
  editor,
  dandyBannerUrl,
}: {
  editor: Editor;
  dandyBannerUrl: string;
}) => {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [open, setOpen] = useState(false);

  const handleInsert = () => {
    if (!url.trim()) {
      toast.error("Image URL is required");
      return;
    }
    editor.chain().focus().setImage({ src: url.trim(), alt: alt.trim() || "" }).run();
    setUrl("");
    setAlt("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          title="Insert Image"
          className="p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3" align="start">
        <div>
          <label className="text-[11px] text-muted-foreground mb-0.5 block">
            Image URL
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="text-sm h-8"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-0.5 block">
            Alt Text
          </label>
          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Describe the image"
            className="text-sm h-8"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleInsert}
            className="flex-1 h-7 text-xs"
          >
            Insert
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              editor
                .chain()
                .focus()
                .setImage({ src: dandyBannerUrl, alt: "Dandy" })
                .run();
              setOpen(false);
            }}
            className="flex-1 h-7 text-xs"
          >
            Dandy Banner
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* ── Merge Variable Buttons ── */
const MERGE_VARS = [
  { label: "First Name", variable: "first_name" },
  { label: "Last Name", variable: "last_name" },
  { label: "Company", variable: "company" },
  { label: "Microsite URL", variable: "microsite_url" },
];

/* ── Convert TipTap HTML to inline-CSS email HTML ── */
const toEmailHTML = (html: string): string => {
  // Wrap in email container
  let output = html;

  // Replace merge variable spans back to raw tags
  output = output.replace(
    /<span[^>]*data-merge-variable="([^"]*)"[^>]*>[^<]*<\/span>/g,
    "{{$1}}"
  );

  // Inline styles for email compatibility
  output = output
    .replace(/<p style="text-align:\s*(center|right|left)">/g, (_, align) =>
      `<p style="font-size:16px;line-height:24px;color:#1a1a1a;margin:0 0 16px;text-align:${align};">`)
    .replace(/<p>/g, '<p style="font-size:16px;line-height:24px;color:#1a1a1a;margin:0 0 16px;">')
    .replace(/<h1 style="text-align:\s*(center|right|left)">/g, (_, align) =>
      `<h1 style="font-size:24px;line-height:32px;font-weight:bold;color:#1a1a1a;margin:0 0 16px;text-align:${align};">`)
    .replace(/<h1>/g, '<h1 style="font-size:24px;line-height:32px;font-weight:bold;color:#1a1a1a;margin:0 0 16px;">')
    .replace(/<h2 style="text-align:\s*(center|right|left)">/g, (_, align) =>
      `<h2 style="font-size:20px;line-height:28px;font-weight:bold;color:#1a1a1a;margin:0 0 16px;text-align:${align};">`)
    .replace(/<h2>/g, '<h2 style="font-size:20px;line-height:28px;font-weight:bold;color:#1a1a1a;margin:0 0 16px;">')
    .replace(/<ul>/g, '<ul style="padding-left:24px;margin:0 0 16px;">')
    .replace(/<li>/g, '<li style="font-size:16px;line-height:24px;color:#1a1a1a;margin:0 0 8px;">')
    .replace(/<a /g, '<a style="color:#16a34a;" ')
    .replace(/<hr\s*\/?>/g, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />')
    .replace(/<img /g, '<img style="max-width:100%;display:block;margin:16px 0;" ');

  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">${output}</div>`;
};

/* ── Parse email HTML back to editor-friendly HTML ── */
const fromEmailHTML = (html: string): string => {
  let output = html;

  // Unwrap the outer div wrapper
  output = output.replace(
    /^<div[^>]*style="[^"]*font-family:Arial[^"]*"[^>]*>([\s\S]*)<\/div>$/,
    "$1"
  );

  // Convert merge tags to spans ONLY in text content (not inside HTML attributes like href).
  // Split on HTML tags, only replace {{var}} in text segments.
  output = output.replace(
    /(<[^>]*>)|(\{\{(\w+)\}\})/g,
    (match, tag, _full, varName) => {
      if (tag) return tag; // HTML tag — leave untouched
      return `<span data-merge-variable="${varName}" style="background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:4px;font-size:13px;font-family:monospace;user-select:all;">{{${varName}}}</span>`;
    }
  );

  // Strip inline styles so tiptap can parse cleanly
  output = output.replace(/ style="[^"]*"/g, "");

  return output;
};

/* ── Main Editor Component ── */
const EmailWYSIWYGEditor = forwardRef<EmailEditorHandle, EmailWYSIWYGEditorProps>(
  ({ initialContent = "", onChange, dandyBannerUrl }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2] },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { style: "color:#16a34a;" },
        }),
        Image.configure({
          HTMLAttributes: { style: "max-width:100%;display:block;" },
        }),
        Placeholder.configure({
          placeholder: "Start writing your email…",
        }),
        TextAlign.configure({
          types: ["heading", "paragraph"],
          alignments: ["left", "center", "right"],
        }),
        MergeVariable,
      ],
      content: initialContent ? fromEmailHTML(initialContent) : "",
      onUpdate: ({ editor }) => {
        onChange?.(toEmailHTML(editor.getHTML()));
      },
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none focus:outline-none min-h-[280px] px-4 py-3 [&_p]:my-2 [&_h1]:my-3 [&_h2]:my-3 [&_ul]:my-2 [&_img]:rounded [&_img]:max-w-full",
        },
      },
    });

    useImperativeHandle(ref, () => ({
      getHTML: () => (editor ? toEmailHTML(editor.getHTML()) : ""),
      setContent: (html: string) => {
        editor?.commands.setContent(fromEmailHTML(html));
      },
      isEmpty: () => editor?.isEmpty ?? true,
    }));

    const insertMergeVar = useCallback(
      (variable: string) => {
        editor
          ?.chain()
          .focus()
          .insertContent({
            type: "mergeVariable",
            attrs: { variable },
          })
          .run();
      },
      [editor]
    );

    const insertMicrositeLink = useCallback(() => {
      editor
        ?.chain()
        .focus()
        .insertContent(
          '<a href="{{microsite_url}}">View your personalized page</a>'
        )
        .run();
    }, [editor]);

    const insert2Col = useCallback(() => {
      // TipTap doesn't support <table>, so insert as two sections with a divider.
      // toEmailHTML will convert the data-two-col markers into a real table for email clients.
      editor
        ?.chain()
        .focus()
        .insertContent(
          `<h2>Left column</h2><p>Content here</p><hr/><h2>Right column</h2><p>Content here</p>`
        )
        .run();
      toast.info("Two-column layout inserted — it will render as a table in the final email.");
    }, [editor]);

    const insertDandyBanner = useCallback(() => {
      editor
        ?.chain()
        .focus()
        .setImage({ src: dandyBannerUrl, alt: "Dandy" })
        .run();
    }, [editor, dandyBannerUrl]);

    const insertSignature = useCallback(() => {
      editor
        ?.chain()
        .focus()
        .insertContent(
          "<p>Best,<br/>{{sender_name}}</p>"
        )
        .run();
    }, [editor]);

    const [htmlMode, setHtmlMode] = useState(false);
    const [rawHtml, setRawHtml] = useState("");

    const toggleHtmlMode = useCallback(() => {
      if (htmlMode) {
        // Switching back to visual: sync raw HTML into editor
        editor?.commands.setContent(fromEmailHTML(rawHtml));
        onChange?.(rawHtml);
      } else {
        // Switching to HTML: populate textarea with current email HTML
        const current = editor ? toEmailHTML(editor.getHTML()) : "";
        setRawHtml(current);
      }
      setHtmlMode((prev) => !prev);
    }, [htmlMode, rawHtml, editor, onChange]);

    const handleRawHtmlChange = useCallback(
      (value: string) => {
        setRawHtml(value);
        onChange?.(value);
      },
      [onChange]
    );

    if (!editor) return null;

    return (
      <div className="border border-border rounded-lg overflow-hidden bg-background">
        {/* Main toolbar */}
        <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-border bg-muted/30">
          {!htmlMode && (
            <>
              <ToolbarBtn
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive("bold")}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive("italic")}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </ToolbarBtn>

              <LinkPopover editor={editor} />

              <ToolbarBtn
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive("bulletList")}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </ToolbarBtn>

              <ToolbarBtn
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
                active={editor.isActive("heading", { level: 1 })}
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                active={editor.isActive("heading", { level: 2 })}
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </ToolbarBtn>

              <ToolbarBtn
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Divider"
              >
                <Minus className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() =>
                  editor.chain().focus().clearNodes().unsetAllMarks().run()
                }
                title="Clear Formatting"
              >
                <RemoveFormatting className="w-4 h-4" />
              </ToolbarBtn>

              <div className="w-px h-5 bg-border mx-1" />

              <ToolbarBtn
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                active={editor.isActive({ textAlign: "left" })}
                title="Align Left"
              >
                <AlignLeft className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                active={editor.isActive({ textAlign: "center" })}
                title="Align Center"
              >
                <AlignCenter className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                active={editor.isActive({ textAlign: "right" })}
                title="Align Right"
              >
                <AlignRight className="w-4 h-4" />
              </ToolbarBtn>

              <div className="w-px h-5 bg-border mx-1" />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={insertMicrositeLink}
                title="Insert Microsite Link"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Globe className="w-3.5 h-3.5" /> Microsite
              </button>

              <ImagePopover editor={editor} dandyBannerUrl={dandyBannerUrl} />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={insert2Col}
                title="Insert 2-Column Block"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Columns className="w-3.5 h-3.5" /> 2-Col
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={insertDandyBanner}
                title="Insert Dandy Banner"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Banner
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={insertSignature}
                title="Insert Signature Block"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                ✍️ Signature
              </button>
            </>
          )}

          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleHtmlMode}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                htmlMode
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Code className="w-3.5 h-3.5" /> {htmlMode ? "Visual Editor" : "View HTML"}
            </button>
          </div>
        </div>

        {!htmlMode && (
          /* Merge variable buttons */
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/10">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-1">
              Merge:
            </span>
            {MERGE_VARS.map((mv) => (
              <button
                key={mv.variable}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMergeVar(mv.variable)}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors border border-sky-200"
              >
                {`{{${mv.variable}}}`}
              </button>
            ))}
          </div>
        )}

        {/* Editor area / HTML code view */}
        {htmlMode ? (
          <textarea
            value={rawHtml}
            onChange={(e) => handleRawHtmlChange(e.target.value)}
            className="w-full min-h-[280px] px-4 py-3 font-mono text-xs text-foreground bg-background focus:outline-none resize-y"
            spellCheck={false}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    );
  }
);

EmailWYSIWYGEditor.displayName = "EmailWYSIWYGEditor";

export { EmailWYSIWYGEditor, toEmailHTML, fromEmailHTML };
