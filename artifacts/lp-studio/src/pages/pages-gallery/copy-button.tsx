import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60"
    >
      {copied ? (
        <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</>
      ) : (
        <><Copy className="w-3.5 h-3.5" /> Copy URL</>
      )}
    </button>
  );
}
