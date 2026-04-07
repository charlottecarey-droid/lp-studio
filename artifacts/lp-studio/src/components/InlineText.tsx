import { useEffect, useState, ElementType } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";

interface InlineTextProps {
  value: string;
  onUpdate?: (value: string) => void;
  className?: string;
  multiline?: boolean;
  as?: ElementType;
  style?: React.CSSProperties;
}

function valueToHtml(value: string): string {
  if (!value) return "<p></p>";
  return value
    .split("\n\n")
    .map(para => `<p>${para.replace(/\n/g, "<br/>") || "<br/>"}</p>`)
    .join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function editorToValue(editor: any): string {
  if (!editor) return "";
  const json = editor.getJSON();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paragraphs = (json.content ?? []).map((node: any) => {
    if (node.type !== "paragraph") return "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (node.content ?? []).map((c: any) => {
      if (c.type === "text") return c.text ?? "";
      if (c.type === "hardBreak") return "\n";
      return "";
    }).join("");
  });
  return paragraphs.join("\n\n").replace(/\n\n$/, "");
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        bold: false,
        italic: false,
        code: false,
        strike: false,
      }),
    ],
    content: valueToHtml(value),
    editable: false,
    onUpdate: ({ editor }) => {
      onUpdate?.(editorToValue(editor));
    },
    editorProps: {
      attributes: {
        class: cn("outline-none focus:outline-none cursor-text", className || ""),
      },
      handleKeyDown(_view, event) {
        if (event.key === "Escape") {
          setIsEditing(false);
          return true;
        }
        if (event.key === "Enter" && !multiline) {
          setIsEditing(false);
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditing);
    if (isEditing) {
      setTimeout(() => editor.commands.focus("end"), 0);
    }
  }, [isEditing, editor]);

  useEffect(() => {
    if (editor && !isEditing) {
      const newContent = valueToHtml(value);
      if (editor.getHTML() !== newContent) {
        editor.commands.setContent(newContent);
      }
    }
  }, [value, editor, isEditing]);

  useEffect(() => {
    return () => { editor?.destroy(); };
  }, [editor]);

  if (!onUpdate) {
    return (
      <Tag className={className} style={{ whiteSpace: "pre-line", ...style }}>
        {value}
      </Tag>
    );
  }

  if (isEditing) {
    return (
      <span
        className={cn("relative inline-block w-full", className)}
        style={style}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <EditorContent
          editor={editor}
          onBlur={() => setIsEditing(false)}
        />
        <span className="absolute -bottom-5 left-0 text-[9px] bg-primary text-primary-foreground px-1 rounded whitespace-nowrap z-50 pointer-events-none">
          {multiline ? "Shift+Enter = new line, Enter = new paragraph" : "Enter or click outside to save"}
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
        setIsEditing(true);
      }}
      title="Click to edit"
    >
      {value}
    </Tag>
  );
}
