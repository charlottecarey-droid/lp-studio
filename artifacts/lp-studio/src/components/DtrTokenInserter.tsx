import { useState } from "react";
import { Braces } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DTR_TOKENS } from "@/lib/dtr";

interface Props {
  onInsert: (token: string) => void;
}

export function DtrTokenInserter({ onInsert }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground gap-1"
          title="Insert dynamic token"
        >
          <Braces className="w-3 h-3" />
          DTR
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Dynamic Tokens
        </p>
        {DTR_TOKENS.map(({ token, label, description }) => (
          <button
            key={token}
            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center justify-between gap-2"
            onClick={() => {
              onInsert(token);
              setOpen(false);
            }}
          >
            <span className="font-medium">{label}</span>
            <code className="text-[10px] text-muted-foreground font-mono">{token}</code>
          </button>
        ))}
        <div className="border-t mt-1 pt-1 px-2 py-1.5">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Tokens are replaced with URL parameter values when visitors land on the page. Use <code className="text-[10px]">{"{{param|fallback}}"}</code> for default text.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
