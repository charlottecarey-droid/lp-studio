import { useEffect, useRef, useState } from "react";
import {
  Copy,
  FlaskConical,
  Link2,
  MoreHorizontal,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE, type Page } from "./types";
import { SaveTemplateDialog } from "./save-template-dialog";

export function PageActionsMenu({
  page,
  cloningPageId,
  onClone,
  onAbTest,
  onLinks,
  onShare,
  onDelete,
  onTemplateSaved,
}: {
  page: Page;
  cloningPageId: number | null;
  onClone: () => void;
  onAbTest: () => void;
  onLinks: () => void;
  onShare: () => void;
  onDelete: () => void;
  onTemplateSaved: (updated: Page) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleRemoveTemplate = async () => {
    setOpen(false);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${page.id}/mark-template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTemplate: false, templateLabel: null, templateDescription: null }),
      });
      if (res.ok) {
        const updated: Page = await res.json();
        onTemplateSaved(updated);
      }
    } catch {
      alert("Failed to remove template. Please try again.");
    }
  };

  const items = [
    {
      icon: <Copy className="w-3.5 h-3.5" />,
      label: cloningPageId === page.id ? "Duplicating…" : "Duplicate",
      onClick: () => { setOpen(false); onClone(); },
      disabled: cloningPageId === page.id,
    },
    {
      icon: <FlaskConical className="w-3.5 h-3.5" />,
      label: "A/B Test",
      onClick: () => { setOpen(false); onAbTest(); },
    },
    {
      icon: <Link2 className="w-3.5 h-3.5" />,
      label: "Personalized Links",
      onClick: () => { setOpen(false); onLinks(); },
    },
    {
      icon: <Share2 className="w-3.5 h-3.5" />,
      label: "Share for Review",
      onClick: () => { setOpen(false); onShare(); },
    },
  ];

  return (
    <>
      <div className="relative" ref={ref}>
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          title="More actions"
          onClick={() => setOpen(v => !v)}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>

        {open && (
          <div className="absolute bottom-full right-0 mb-1 z-50 min-w-[200px] bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
            {items.map(item => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={item.onClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="text-muted-foreground">{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div className="h-px bg-border mx-2 my-1" />
            {page.isTemplate ? (
              <button
                type="button"
                onClick={handleRemoveTemplate}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              >
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                Remove from Templates
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setOpen(false); setShowTemplateDialog(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              >
                <Star className="w-3.5 h-3.5" />
                Save as Template
              </button>
            )}
            <div className="h-px bg-border mx-2 my-1" />
            <button
              type="button"
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>

      {showTemplateDialog && (
        <SaveTemplateDialog
          page={page}
          onClose={() => setShowTemplateDialog(false)}
          onSaved={onTemplateSaved}
        />
      )}
    </>
  );
}
