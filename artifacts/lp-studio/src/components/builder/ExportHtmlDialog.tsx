/**
 * Export HTML dialog — fetches a portable, static HTML copy of the published
 * page from the API and lets the user copy it to the clipboard or download it
 * as a .html file to host in another tool.
 *
 * The server builds the file from the published snapshot: scripts are
 * stripped (forms/interactive widgets won't run off-platform) and asset URLs
 * are absolutized against the live site, so the copy renders correctly
 * anywhere but stays visually dependent on the page remaining published.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download, FileCode, Loader2 } from "lucide-react";

const API_BASE = "/api";

interface ExportHtmlDialogProps {
  open: boolean;
  onClose: () => void;
  pageId: number;
}

export function ExportHtmlDialog({ open, onClose, pageId }: ExportHtmlDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [filename, setFilename] = useState("page.html");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtml(null);
    setCopied(false);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/lp/pages/${pageId}/export-html`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.html) {
          setError(data?.error ?? "Export failed — please try again.");
        } else {
          setHtml(data.html);
          setFilename(typeof data.filename === "string" ? data.filename : "page.html");
        }
      } catch {
        if (!cancelled) setError("Export failed — please check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  function handleCopy() {
    if (!html) return;
    navigator.clipboard.writeText(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-600" />
            Export HTML
          </DialogTitle>
          <DialogDescription>
            A static copy of your published page you can paste or upload into another
            website tool. Images and styling load from your live site, so keep the page
            published. Forms and other interactive elements won't work in the exported copy.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing your export…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" data-testid="export-html-error">
            {error}
          </div>
        )}

        {html && !loading && (
          <>
            <textarea
              readOnly
              value={html}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-56 rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-snug resize-none focus:outline-none"
              data-testid="export-html-code"
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={handleCopy} className="gap-2" data-testid="export-html-copy">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy code"}
              </Button>
              <Button onClick={handleDownload} className="gap-2" data-testid="export-html-download">
                <Download className="w-4 h-4" />
                Download {filename}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
