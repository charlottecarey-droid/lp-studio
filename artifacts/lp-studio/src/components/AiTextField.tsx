import { useState } from "react";
import { Wand2, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AiTextFieldProps {
  type?: "textarea" | "input";
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  onSuggest?: () => Promise<string[]>;
  fieldLabel?: string;
  brandVoiceSet?: boolean;
}

export function AiTextField({
  type = "textarea",
  value,
  onChange,
  rows = 2,
  placeholder,
  className,
  onSuggest,
  fieldLabel,
  brandVoiceSet,
}: AiTextFieldProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSuggest = async () => {
    if (!onSuggest) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const results = await onSuggest();
      setSuggestions(results);
    } catch (e) {
      void e;
      setError("Couldn't generate suggestions. Check your brand settings or try again.");
    } finally {
      setLoading(false);
    }
  };

  const apply = (s: string) => {
    onChange(s);
    setOpen(false);
  };

  const sharedClass = cn("text-sm resize-none pr-8", className);
  const showBrandNudge = brandVoiceSet === false;

  return (
    <div className="relative">
      {type === "textarea" ? (
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={sharedClass}
        />
      ) : (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={sharedClass}
        />
      )}

      {onSuggest && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={handleSuggest}
              title="Suggest with AI"
              className={cn(
                "absolute right-2 top-2 p-0.5 rounded transition-colors",
                "text-muted-foreground/50 hover:text-primary",
                open && "text-primary",
              )}
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            className="w-72 p-3 space-y-2"
            onOpenAutoFocus={e => e.preventDefault()}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {fieldLabel ? `Suggestions — ${fieldLabel}` : "AI Suggestions"}
            </p>

            {loading && (
              <div className="flex items-center gap-2 py-3 text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Generating suggestions…</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-2 py-1 text-destructive">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="text-xs">{error}</span>
              </div>
            )}

            {!loading && !error && suggestions.length > 0 && (
              <>
                <div className="space-y-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => apply(s)}
                      className="w-full text-left text-xs px-2.5 py-2 rounded-lg border border-border bg-background hover:bg-primary/5 hover:border-primary/40 transition-colors leading-snug"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full text-xs text-center text-muted-foreground hover:text-foreground pt-1 transition-colors"
                >
                  Dismiss
                </button>
              </>
            )}

            {showBrandNudge && !loading && (
              <div className="pt-1 border-t border-border/60 mt-1">
                <a
                  href="/brand"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Sparkles className="w-3 h-3 shrink-0" />
                  For better results, set up brand voice →
                </a>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
